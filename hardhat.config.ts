import * as dotenv from 'dotenv';

import { HardhatUserConfig, task } from 'hardhat/config';
import '@nomicfoundation/hardhat-verify';
import '@nomiclabs/hardhat-waffle';
import 'hardhat-deploy';
import '@typechain/hardhat';
import 'hardhat-gas-reporter';
import 'solidity-coverage';

import './src/tasks/airdrop';
import './src/tasks/deploy_contracts';

dotenv.config();

// This is a sample Hardhat task. To learn how to create your own go to
// https://hardhat.org/guides/create-task.html
task('accounts', 'Prints the list of accounts', async (taskArgs, hre) => {
  const accounts = await hre.ethers.getSigners();

  for (const account of accounts) {
    console.log(account.address);
  }
});

// You need to export an object to set up your config
// Go to https://hardhat.org/config/ to learn more

const config: HardhatUserConfig = {
  paths: {
    // artifacts: "build/artifacts",
    // cache: "build/cache",
    deploy: 'src/deploy',
    // sources: "contracts",
  },
  solidity: {
    compilers: [{ version: '0.8.22' }, { version: '0.6.12' }],
  },
  networks: {
    mainnet: {
      chainId: 1,
      url: process.env.MAINNET_PROVIDER || '',
      accounts: process.env.MAINNET_DEPLOYER_PRIVATE_KEY
        ? [process.env.MAINNET_DEPLOYER_PRIVATE_KEY]
        : [],
    },
    goerli: {
      chainId: 5,
      url: process.env.GOERLI_PROVIDER || '',
      accounts: process.env.GOERLI_DEPLOYER_PRIVATE_KEY
        ? [process.env.GOERLI_DEPLOYER_PRIVATE_KEY]
        : [],
    },
    hardhat: {
      chainId: 5,
      forking: {
        url: `https://goerli.infura.io/v3/${process.env.INFURA_KEY}`,
        httpHeaders: {
          Origin: 'localhost:3000', // infura allowlists requests by origin
        },
      },
      accounts: {
        count: 4,
      },
    },
  },
  gasReporter: {
    enabled: true,
    outputFile: 'gas-report.txt',
    noColors: true,
  },
  etherscan: {
    apiKey: process.env.ETHERSCAN_API_KEY,
  },
};

export default config;
