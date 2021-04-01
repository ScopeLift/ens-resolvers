require("@nomiclabs/hardhat-truffle5");
require("@nomiclabs/hardhat-ethers");

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
};
