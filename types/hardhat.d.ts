import { HardhatUserConfig } from 'hardhat/types';

export type HardhatConfig = HardhatUserConfig & {
  deploymentArguments: {
    [networkName: string]: {
      SPT_TOKEN_ADDRESS: string;
      SAFE_SALT: string;
    };
  };
};
