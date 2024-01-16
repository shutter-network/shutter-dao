import 'hardhat-deploy';
import { task } from 'hardhat/config';
import { getDeploymentArguments } from '../utils/deploy';
import { type HardhatConfig } from '../../types/hardhat';

task('verify-contracts', 'Verifies the already deployed Shutter Token & DAO contracts').setAction(
  async (_, hre) => {
    const { deployments, config, network } = hre;

    const vestingPoolDeployment = await deployments.get('VestingPool');

    const tokenAddress = getDeploymentArguments<string>(
      'SPT_TOKEN_ADDRESS',
      config as unknown as HardhatConfig,
      network.name,
    );

    try {
      // use hardhat verify only for the vesting pool
      // etherscan-verify manages to verify all other contracts
      await hre.run('verify:verify', {
        address: vestingPoolDeployment.address,
        constructorArguments: [tokenAddress],
      });
      await hre.run('etherscan-verify', { forceLicense: true, license: 'LGPL-3.0' });
    } catch (e) {
      console.error(e);
    }
  },
);

export {};
