#!/usr/bin/env node

const { prompt } = require('inquirer');
const bitcoin = require('bitcoin');
const program = require('commander');
const Request = require('request');

program
  .version('0.1.0')
  .description('DigiAsset CLI Example')
  .option('-u, --user <string>', 'Digibyte RPC User (default: user)')
  .option('-p, --password <string>', 'Digibyte RPC Password (default: password)')
  .option('-o, --port <number>', 'Digibyte RPC Port (default: 14022)')
  .parse(process.argv);


const asset = {
  amount: 100,
  fee: 5000,
  divisibility: 0,
  reissuable: false
};
let hasOwnAddress = false;

const client = new bitcoin.Client({
  host: 'localhost',
  port: program.port || 14022,
  user: program.user || 'user',
  pass: program.password || 'password',
  timeout: 30000
});

function start () {
  return prompt({
    type: 'list',
    name: 'hasAddress',
    message: 'Do you have already have a public/private keypair with unspent DGB associated?',
    choices: ['yes', 'no']
  })
    .then(answer => {
      if (answer.hasAddress === 'yes') {
        hasOwnAddress = true;
        gatherAssetData();
      } else {
        getNewAddress();
      }
    });
}

function getNewAddress () {
  console.log("\x1b[32m%s\x1b[0m", 'Generating new address and sending 0.1 DGB to it');
  client.cmd('getnewaddress', (err, address) => {
    if (err) console.log(err);
    asset.issueAddress = address;
    client.cmd('sendtoaddress', address, 0.1, (err, txid) => {
      if (err) console.log(err);
      return shouldContinue()
        .then(shouldContinue => gatherAssetData());
    });
  });

  console.log("\x1b[35m%s\x1b[0m", 'EXECUTING FUNCTION:');
  console.log('===================');
  console.log("\x1b[33m%s\x1b[0m", `function getNewAddress () {
    client.cmd('getnewaddress', (err, address) => {
      if (err) console.log(err);
      asset.issueAddress = address;
      client.cmd('sendtoaddress', address, 0.1, (err, txid) => {
        if (err) console.log(err);
      });
    });
}`);
  console.log('===================');
}

function gatherAssetData () {
  console.log("\x1b[32m%s\x1b[0m", 'Create initial asset data');
  const questions = [
    {
      type: 'input',
      name: 'amount',
      message: 'Enter Amount (100)'
    },
    {
      type: 'input',
      name: 'fee',
      message: 'Enter fee amount (5000)'
    },
    {
      type: 'input',
      name: 'divisibility',
      message: 'Asset Divisibility (0)'
    },
    {
      type: 'list',
      name: 'reissuable',
      message: 'Asset locked (true/false)',
      choices: ['true', 'false' ]
    }
  ];
  if (hasOwnAddress) {
    questions.unshift({
      type: 'input',
      name: 'issueAddress',
      message: 'Enter funded Digibyte address'
    })
  }
  return prompt(questions).then(answers => {
    if (hasOwnAddress) {
      asset.issueAddress = answers.issueAddress;
    }
    asset.amount = answers.amount.length ? answers.amount : 100;
    asset.fee = answers.fee.length ? answers.fee : 5000;
  
    asset.divisibility = answers.divisibility.length ? answers.divisibility : 0;
    asset.reissueable = answers.reissueable;
    confirmInitialAsset();
  });
}

function confirmInitialAsset () {
  console.log("\x1b[32m%s\x1b[0m", 'Current Asset:');
  console.log("\x1b[33m%s\x1b[0m", JSON.stringify(asset, null, 4));
  return shouldContinue()
    .then(shouldContinue => {
      return prompt({
        type: 'list',
        name: 'confirmed',
        message: `Do you want to add any metadata`,
        choices: ['yes', 'no' ]
      });      
    })
    .then(answer => {
      if (answer.confirmed === 'yes') {
        return addMetadata();
      }
      return issueAsset(asset);      
    });
}

function addMetadata () {
  const metadata = {};
  const questions =  [
    {
      type: 'input',
      name: 'assetId',
      message: 'Give the asset an ID'
    },
    {
      type: 'input',
      name: 'assetName',
      message: 'Asset Name'
    },
    {
      type: 'input',
      name: 'issuer',
      message: 'Asset Issuer'
    },
    {
      type: 'input',
      name: 'description',
      message: 'Asset Description' 
    },
    {
      type: 'input',
      name: 'icon',
      message: 'Icon URL'
    }
  ];
  return prompt(questions)
    .then(answers => {
      metadata.assetId = answers.assetId.length ? answers.assetId : 1;
      metadata.assetName = answers.assetName.length ? answers.assetName : 'Test DigiAsset';
      metadata.description = answers.description.length ? answers.description : 'This is a test DigiAsset created from DigiAssetCLIExample';
      metadata.urls = [ { name: 'icon', url: answers.icon.length ? answers.icon : 'https://avatars0.githubusercontent.com/u/6278682?s=400&v=4', mimeType: 'image/png', dataHash: '' } ];
      asset.metadata = metadata;
      console.log("\x1b[32m%s\x1b[0m", 'Current Asset:');
      console.log("\x1b[33m%s\x1b[0m", JSON.stringify(asset, null, 4));
      return shouldContinue()
        .then(shouldContinue => issueAsset(asset));
    });
}

function issueAsset (assetData) {
  console.log("\x1b[32m%s\x1b[0m", 'Send the asset data to the DigiAssets API');
  Request({
    method: 'POST',
    url: 'https://api.digiassets.net/v3/issue',
    form: assetData,
    headers: {'Content-Type': 'application/json'},
    json: true
  }, (err, resp, body) => {
    if (err) console.log(err);
    const txHex = body.txHex;
    if (hasOwnAddress) {
      console.log("\x1b[32m%s\x1b[0m", 'This raw transaction now needs to be signed with the private key, Once done we can broadcast the transaction');
      console.log(txHex);
      return shouldContinue()
        .then(shouldContinue => getSignedTransaction());
    } else {
      console.log("\x1b[32m%s\x1b[0m", 'This raw transaction now needs to be signed with out wallet');
      return shouldContinue()
        .then(shouldContinue => signRawTransaction(txHex))
    }
  });
  console.log("\x1b[35m%s\x1b[0m", 'EXECUTING FUNCTION:');
  console.log('===================');
  console.log("\x1b[33m%s\x1b[0m", `function issueAsset (assetData) {
  Request({
    method: 'POST',
    url: 'https://api.digiassets.net/v3/issue',
    form: assetData,
    headers: {'Content-Type': 'application/json'},
    json: true
  }, (err, resp, body) => {
    const txHex = body.txHex;
    console.log(txHex);
  });
}`);
  console.log('===================');
}

function getSignedTransaction () {
  return prompt({
    type: 'input',
    name: 'txHex',
    message: 'Please enter the signed Tx'
  })
    .then(answer => {
      return broadcastTransaction(answer.txHex);
    })
}

function signRawTransaction (txHex) {
  console.log("\x1b[32m%s\x1b[0m", 'Signing the raw transaction');
  client.cmd('signrawtransactionwithwallet', txHex, (err, response) => {
    if (err) console.log(err);
    return shouldContinue()
      .then(shouldContinue => broadcastTransaction(response.hex));
  });

  console.log("\x1b[35m%s\x1b[0m", 'EXECUTING FUNCTION:');
  console.log('===================');
  console.log("\x1b[33m%s\x1b[0m", `function signRawTransaction (txHex) {
  client.cmd('signrawtransactionwithwallet', txHex, (err, response) => {
    if (err) console.log(err);
    broadcastTransaction(response.hex);
  });
}`);
  console.log('===================');
}

function broadcastTransaction (signedTxHex) {
  console.log("\x1b[32m%s\x1b[0m", 'Send the signed transaction containing our asset to the DigiAssets API for broadcasting');
  Request({
    method: 'POST',
    url: 'https://api.digiassets.net/v3/broadcast',
    form: {
      txHex: signedTxHex
    },
    json: true
  }, (err, resp, body) => {
    const txid = body.txid;
    console.log("\x1b[32m%s\x1b[0m", 'Asset has been sent on the DigiByte Blockchain!!');
    console.log('TXID: ', txid);
  });
  console.log("\x1b[35m%s\x1b[0m", 'EXECUTING FUNCTION:');
  console.log('===================');
  console.log("\x1b[33m%s\x1b[0m", `function broadcastTransaction (signedTxHex) {
  Request({
    method: 'POST',
    url: 'https://api.digiassets.net/v3/broadcast',
    form: {
      txHex: signedTxHex
    },
    json: true
  }, (err, resp, body) => {
    const txid = body.txid;
    console.log(txid);
  });
}`);
  console.log('===================');
}

function shouldContinue () {
  return prompt({
    type: 'Confirm',
    name: 'continue',
    message: 'Continue (y/n)'
  })
    .then(answer => {
      if (answer.continue === 'y' || answer.continue === 'Y' || answer.continue.toLowerCase() === 'yes') {
        return true;
      } else if (answer.continue === 'n' || answer.continue === 'N' || answer.continue.toLowerCase() === 'no') {
        return process.exit(0);
      }
      return shouldContinue();
    });
}

start();