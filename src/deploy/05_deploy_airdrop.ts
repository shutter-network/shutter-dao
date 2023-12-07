import '@nomiclabs/hardhat-ethers';

import { ethers } from 'hardhat';
import { getPredictedSafeAddress } from '../tasks/task_utils';
import { BigNumber } from 'ethers';

const deployContracts = async function ({ deployments, config, network }) {
  const { deploy } = deployments;

  const [deployer] = await ethers.getSigners();

  const vestingPoolManager = await deployments.get('VestingPoolManager');
  const shutterToken = await deployments.get('ShutterToken');

  const predictedSafeAddress = await getPredictedSafeAddress();

  if (!config.deploymentArguments[network.name]) {
    throw new Error('deploymentArguments not found in config for network: ' + network.name);
  }

  const { AIRDROP_ROOT_HASH, AIRDROP_REDEEM_DEADLINE } = config.deploymentArguments[network.name];

  if (!AIRDROP_ROOT_HASH) {
    throw new Error('AIRDROP_ROOT_HASH not found in config for network: ' + network.name);
  }

  if (!AIRDROP_REDEEM_DEADLINE) {
    throw new Error('AIRDROP_REDEEM_DEADLINE not found in config for network: ' + network.name);
  }

  const airdropDeployment = await deploy('Airdrop', {
    from: await deployer.getAddress(),
    args: [
      shutterToken.address,
      predictedSafeAddress,
      AIRDROP_REDEEM_DEADLINE,
      vestingPoolManager.address,
      AIRDROP_ROOT_HASH,
    ],
    log: true,
  });

  const airdrop = await ethers.getContractAt('Airdrop', airdropDeployment.address);
  console.table({
    airdrop: airdrop.address,
    airdropRedeemDeadline: BigNumber.from(await airdrop.redeemDeadline()).toString(),
    airdropRedeemDeadlineHumanReadable: new Date(
      (await airdrop.redeemDeadline()) * 1000,
    ).toLocaleString(),
    airdropRootHash: await airdrop.root(),
  });

  return true;
};

deployContracts.tags = ['Airdrop'];
deployContracts.dependencies = ['ShutterToken', 'VestingPoolManager'];

deployContracts.id = 'Airdrop';
export default deployContracts;
