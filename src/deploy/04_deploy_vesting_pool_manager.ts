import '@nomiclabs/hardhat-ethers';

import { ethers } from 'hardhat';
import { getPredictedSafeAddress } from '../tasks/task_utils';

const deployContracts = async function ({ deployments }) {
  const { deploy } = deployments;

  const [deployer] = await ethers.getSigners();

  const vestingPool = await deployments.get('VestingPool');
  const shutterToken = await deployments.get('ShutterToken');

  const predictedSafeAddress = await getPredictedSafeAddress();

  const vestingPoolManager = await deploy('VestingPoolManager', {
    from: await deployer.getAddress(),
    args: [shutterToken.address, vestingPool.address, predictedSafeAddress],
    log: true,
  });

  console.table({
    VestingPoolManager: vestingPoolManager.address,
  });

  return true;
};

deployContracts.tags = ['VestingPoolManager'];
deployContracts.dependencies = ['ShutterToken', 'VestingLibrary', 'VestingPool'];

deployContracts.id = 'VestingPoolManager';
export default deployContracts;
