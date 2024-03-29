import '@nomiclabs/hardhat-ethers';

import { ethers } from 'hardhat';
import { getPredictedSafeAddress } from '../../DaoBuilder/daoUtils';
import { BigNumber } from 'ethers';
import { getDeploymentArguments } from '../utils/deploy';
import { shutterDAOConfig } from '../../config/shutterDAOConfig';

const deployContracts = async function ({ deployments, config, network }) {
  const { deploy } = deployments;

  const [deployer] = await ethers.getSigners();

  const vestingPoolManager = await deployments.get('VestingPoolManager');
  const shutterToken = await deployments.get('ShutterToken');
  const networkName = network.name;
  const safeSalt = getDeploymentArguments<string>('SAFE_SALT', config, networkName);

  const predictedSafeAddress = await getPredictedSafeAddress(safeSalt);

  console.warn('predictedSafeAddress', predictedSafeAddress);

  const airdropDeployment = await deploy('Airdrop', {
    from: await deployer.getAddress(),
    args: [
      shutterToken.address,
      predictedSafeAddress,
      shutterDAOConfig.airdropConfig.redeemDeadline,
      vestingPoolManager.address,
      shutterDAOConfig.airdropConfig.rootHash,
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
