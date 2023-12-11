import '@nomiclabs/hardhat-ethers';

import { ethers } from 'hardhat';
import { getPredictedSafeAddress } from '../../DaoBuilder/daoUtils';
import { BigNumber } from 'ethers';
import { getDeploymentArguments } from '../utils/deploy';

const deployContracts = async function ({ deployments, config, network }) {
  const { deploy } = deployments;

  const [deployer] = await ethers.getSigners();

  const vestingPoolManager = await deployments.get('VestingPoolManager');
  const shutterToken = await deployments.get('ShutterToken');
  const networkName = network.name;
  const safeSalt = getDeploymentArguments<string>('SAFE_SALT', config, networkName);

  const predictedSafeAddress = await getPredictedSafeAddress(safeSalt);

  const rootHash = getDeploymentArguments('SPT_CONVERSION_ROOT_HASH', config, networkName);
  const deadline = getDeploymentArguments('SPT_CONVERSION_DEADLINE', config, networkName);
  const sptTokenAddress = getDeploymentArguments('SPT_TOKEN_ADDRESS', config, networkName);

  const airdropDeployment = await deploy('SptConversion', {
    from: await deployer.getAddress(),
    args: [
      shutterToken.address,
      predictedSafeAddress,
      deadline,
      vestingPoolManager.address,
      rootHash,
      sptTokenAddress,
    ],
    log: true,
  });

  const sptConversion = await ethers.getContractAt('SptConversion', airdropDeployment.address);
  console.table({
    sptConversion: sptConversion.address,
    sptConversionRedeemDeadline: BigNumber.from(await sptConversion.redeemDeadline()).toString(),
    sptConversionRedeemDeadlineHumanReadable: new Date(
      (await sptConversion.redeemDeadline()) * 1000,
    ).toLocaleString(),
    sptConversionRootHash: await sptConversion.root(),
  });

  return true;
};

deployContracts.tags = ['SptConversion'];
deployContracts.dependencies = ['ShutterToken', 'VestingPoolManager'];

deployContracts.id = 'SptConversion';
export default deployContracts;
