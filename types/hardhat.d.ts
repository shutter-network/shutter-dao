import { HardhatUserConfig } from "hardhat/types";

export type HardhatConfig = HardhatUserConfig & {
    deploymentArguments: {
      [networkName: string]: {
        AIRDROP_ROOT_HASH: string;
        AIRDROP_REDEEM_DEADLINE: number;
        SPT_CONVERSION_DEADLINE: number;
        SPT_CONVERSION_ROOT_HASH: string;
        SPT_TOKEN_ADDRESS: string;
        SAFE_SALT: string;
      };
    };
  };
  