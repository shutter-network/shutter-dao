import '@nomiclabs/hardhat-ethers';

import { ethers } from 'hardhat';
import { getPredictedSafeAddress } from '../tasks/task_utils';
import { BigNumber } from 'ethers';
import { getDeploymentArguments } from '../utils/deploy';

const deployContracts = async function ({ deployments, config, network }) {
  const { deploy } = deployments;

  const [deployer] = await ethers.getSigners();

  const vestingPoolManager = await deployments.get('VestingPoolManager');
  const shutterToken = await deployments.get('ShutterToken');

  const predictedSafeAddress = await getPredictedSafeAddress();

  const networkName = network.name;
  const rootHash = getDeploymentArguments('AIRDROP_ROOT_HASH', config, networkName);
  const deadline = getDeploymentArguments('AIRDROP_REDEEM_DEADLINE', config, networkName);

  const airdropDeployment = await deploy('Airdrop', {
    from: await deployer.getAddress(),
    args: [
      shutterToken.address,
      predictedSafeAddress,
      deadline,
      vestingPoolManager.address,
      rootHash,
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
