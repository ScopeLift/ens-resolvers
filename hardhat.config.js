require('dotenv').config()

// plugins
require("@nomiclabs/hardhat-truffle5");
require("@nomiclabs/hardhat-ethers");
require("@nomiclabs/hardhat-etherscan");

const chainIds = {
  mainnet: 1,
  rinkeby: 4,
};

// Ensure that we have all the environment variables we need.
let mnemonic = '';
if (!process.env.MNEMONIC) {
  console.warn('Please set your MNEMONIC in a .env file');
} else {
  mnemonic = process.env.MNEMONIC;
}

let infuraApiKey = '';
if (!process.env.INFURA_API_KEY) {
  console.warn('Please set your INFURA_API_KEY in a .env file');
} else {
  infuraApiKey = process.env.INFURA_API_KEY;
}

let etherscanApiKey = '';
if (!process.env.ETHERSCAN_API_KEY) {
  console.warn('Please set your ETHERSCAN_API_KEY in a .env file');
} else {
  etherscanApiKey = process.env.ETHERSCAN_API_KEY;
}

function createNetworkConfig(network) {
  const url = 'https://' + network + '.infura.io/v3/' + infuraApiKey;
  return {
    accounts: {
      count: 10,
      initialIndex: 0,
      mnemonic,
      path: "m/44'/60'/0'/0",
    },
    chainId: chainIds[network],
    url,
    gasPrice: 60000000000, // 60 gwei
  };
}

/**
 * @type import('hardhat/config').HardhatUserConfig
 */
module.exports = {
  solidity: {
    version: "0.7.6",
    optimizer: {
      enabled: true,
      runs: 999999,
    },
  },
  networks: {
    rinkeby: createNetworkConfig('rinkeby'),
    mainnet: {
      accounts: {
        count: 10,
        initialIndex: 0,
        mnemonic,
        path: "m/44'/60'/0'/0",
      },
      chainId: chainIds['mainnet'],
      url: `https://mainnet.infura.io/v3/${infuraApiKey}`,
      gasPrice: 60000000000, // 60 gwei
    },
  },
  etherscan: {
    apiKey: etherscanApiKey,
  },
};
