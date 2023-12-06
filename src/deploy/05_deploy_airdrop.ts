import '@nomiclabs/hardhat-ethers';

import { ethers } from 'hardhat';
import { getPredictedSafeAddress } from '../tasks/task_utils';

const deployContracts = async function ({ deployments }) {
  const { deploy } = deployments;

  const [deployer] = await ethers.getSigners();

  const vestingPoolManager = await deployments.get('VestingPoolManager');
  const shutterToken = await deployments.get('ShutterToken');

  const predictedSafeAddress = await getPredictedSafeAddress();

  const airdropRedeemDeadline = 1735689600;

  const airdrop = await deploy('Airdrop', {
    from: await deployer.getAddress(),
    args: [
      shutterToken.address,
      predictedSafeAddress,
      airdropRedeemDeadline,
      vestingPoolManager.address,
    ],
    log: true,
  });

  console.table({
    airdrop: airdrop.address,
  });

  return true;
};

deployContracts.tags = ['Airdrop'];
deployContracts.dependencies = ['ShutterToken', 'VestingPoolManager'];

deployContracts.id = 'Airdrop';
export default deployContracts;
