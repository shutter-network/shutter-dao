import * as dotenv from 'dotenv';

import { HardhatUserConfig, task } from 'hardhat/config';
import '@nomicfoundation/hardhat-verify';
import '@nomiclabs/hardhat-waffle';
import 'hardhat-deploy';
import '@typechain/hardhat';
import 'hardhat-gas-reporter';
import 'solidity-coverage';

import './src/tasks/airdrop';
import './src/tasks/randombytes';
import './src/tasks/deploy_contracts';

import {type HardhatConfig} from './types/hardhat';

dotenv.config();

// This is a sample Hardhat task. To learn how to create your own go to
// https://hardhat.org/guides/create-task.html
task('accounts', 'Prints the list of accounts', async (taskArgs, hre) => {
  const accounts = await hre.ethers.getSigners();

  for (const account of accounts) {
    console.log(account.address);
  }
});


const config: HardhatConfig = {
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
      initialBaseFeePerGas: 0,
      forking: {
        url: `https://goerli.infura.io/v3/${process.env.INFURA_KEY}`,
        httpHeaders: {
          Origin: 'localhost:3000', // infura allowlists requests by origin
        },
      },
      accounts: {
        count: 5,
      },
    },
  },
  deploymentArguments: {
    mainnet: {
      SAFE_SALT: process.env.MAINNET_SAFE_SALT || '',
      AIRDROP_ROOT_HASH: process.env.MAINNET_AIRDROP_ROOT_HASH || '',
      AIRDROP_REDEEM_DEADLINE: process.env.MAINNET_AIRDROP_REDEEM_DEADLINE
        ? parseInt(process.env.MAINNET_AIRDROP_REDEEM_DEADLINE)
        : 0,
      SPT_CONVERSION_DEADLINE: process.env.MAINNET_SPT_CONVERSION_DEADLINE
        ? parseInt(process.env.MAINNET_SPT_CONVERSION_DEADLINE)
        : 0,
      SPT_CONVERSION_ROOT_HASH: process.env.MAINNET_SPT_CONVERSION_ROOT_HASH || '',
      SPT_TOKEN_ADDRESS: '0xcBe3Aef2fA9899d713cA592737b6aEB33668Ba4e',
    },
    goerli: {
      SAFE_SALT: process.env.GOERLI_SAFE_SALT || '',
      AIRDROP_ROOT_HASH: process.env.GOERLI_AIRDROP_ROOT_HASH || '',
      AIRDROP_REDEEM_DEADLINE: process.env.GOERLI_AIRDROP_REDEEM_DEADLINE
        ? parseInt(process.env.GOERLI_AIRDROP_REDEEM_DEADLINE)
        : 0,
      SPT_CONVERSION_DEADLINE: process.env.GOERLI_SPT_CONVERSION_DEADLINE
        ? parseInt(process.env.GOERLI_SPT_CONVERSION_DEADLINE)
        : 0,
      SPT_CONVERSION_ROOT_HASH: process.env.GOERLI_SPT_CONVERSION_ROOT_HASH || '',
      SPT_TOKEN_ADDRESS: process.env.GOERLI_SPT_TOKEN_ADDRESS || '0x62431B10a86FC3264A7E503A7918BB742c449A72',
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
