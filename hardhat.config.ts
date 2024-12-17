import "@nomicfoundation/hardhat-toolbox";
import { HardhatUserConfig } from 'hardhat/config';

import dotenv from "dotenv";

dotenv.config();

const mainnetFork = {
  url: `${process.env.FORK_RPC_PROVIDER}`,
};

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.27",
    settings: {
      optimizer: {
        enabled: true,
        runs: 2000,
      },
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

export default config;

