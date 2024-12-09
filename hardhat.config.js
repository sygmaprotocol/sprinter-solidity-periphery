require("@nomicfoundation/hardhat-toolbox");

const dotenv = require("dotenv");

dotenv.config();

const mainnetFork = {
  url: `${process.env.JSON_RPC_PROVIDER}`,
};

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: "0.8.27",
  settings: {
    optimizer: {
      enabled: true,
      runs: 2000,
    },
  },
  networks: {
    hardhat: {
      chainId: 1,
      forking: mainnetFork,
      accounts: {
        count: 3,
      },
    },
  },
};

