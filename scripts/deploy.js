const fs = require("fs");
const hre = require("hardhat");
const { exit } = require("process");
const { ethers } = hre;
const namehash = require('eth-ens-namehash');

const network = process.env.HARDHAT_NETWORK;

// Initialize object that will hold all deploy info. We'll continually update this and save it to
// a file using the save() method below
const parameters = {
  admin: null,
  contracts: {}, // will be populated with all contract addresses
  actions: {}, // will be populated with deployment actions
};

// Setup for saving off deploy info to JSON files
const now = new Date().toISOString();
const folderName = "./deploy-history";
const fileName = `${folderName}/${network}-${now}.json`;
const latestFileName = `${folderName}/${network}-latest.json`;
fs.mkdir(folderName, (err) => {
  if (err && err.code !== "EEXIST") throw err;
});

// method to save the deploy info to JSON file
//  first one named with network and timestamp, contains all relevant deployment info
//  second one name with network and "latest", contains only contract addresses deployed
const save = (value, field, subfield = undefined) => {
  if (subfield) {
    parameters[field][subfield] = value;
  } else {
    parameters[field] = value;
  }
  fs.writeFileSync(fileName, JSON.stringify(parameters));
};

// IIFE async function so "await"s can be performed for each operation
(async function () {
  try {
    const deployParams = require("./deployParams.json");
    const deployParamsForNetwork = deployParams[network];

    if (!deployParamsForNetwork) {
      console.log("Invalid network requested", network);
      save(network, "actions", "InvalidNetworkRequested");
      exit();
    }

    console.log("Deploying to: ", network);
    save(network, "actions", "DeployingContractsToNetwork");

    const [adminWallet] = await ethers.getSigners();
    save(adminWallet.address, "admin");

    // deploy the forwarding resolver contract
    const ForwardingStealthKeyResolver = await ethers.getContractFactory("ForwardingStealthKeyResolver", adminWallet);
    const fskResolver = await ForwardingStealthKeyResolver.deploy(
      deployParamsForNetwork.ens,
      deployParamsForNetwork.publicResolver,
    );
    await fskResolver.deployed();
    save(fskResolver.address, "contracts", "ForwardingStealthKeyResolver");
    console.log("ForwardingStealthKeyResolver contract deployed to address: ", fskResolver.address);

    // deploy the standalone resolver contract
    const PublicStealthKeyResolver = await ethers.getContractFactory("PublicStealthKeyResolver", adminWallet);
    const pskResolver = await PublicStealthKeyResolver.deploy(
      deployParamsForNetwork.ens,
    );
    await pskResolver.deployed();
    save(pskResolver.address, "contracts", "PublicStealthKeyResolver");
    console.log("PublicStealthKeyResolver contract deployed to address: ", pskResolver.address);

    // deploy the subdomain registrar contract
    const StealthKeyFIFSRegistrar = await ethers.getContractFactory("StealthKeyFIFSRegistrar", adminWallet);
    const registrar = await StealthKeyFIFSRegistrar.deploy(
      deployParamsForNetwork.ens,
      pskResolver.address,
      namehash.hash('umbra.eth'),
    );
    await registrar.deployed();
    save(registrar.address, "contracts", "StealthKeyFIFSRegistrar");
    console.log("StealthKeyFIFSRegistrar contract deployed to address: ", registrar.address);

    // everything went well, save the deployment info in the 'latest' JSON file
    fs.writeFileSync(latestFileName, JSON.stringify(parameters));

    // catch any error from operations above, log it and save it to deploy history file
  } catch (error) {
    save(error.toString(), "actions", "Error");
    console.log("Deployment Error: ", error.toString());
  }
})();
