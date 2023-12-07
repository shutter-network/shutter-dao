import '@nomiclabs/hardhat-ethers';

import { ethers } from 'hardhat';
import { getPredictedSafeAddress } from '../tasks/task_utils';
import { ShutterToken } from '../../typechain';

const deployContracts = async function ({ deployments }) {
  const [deployer] = await ethers.getSigners();

  const shutterTokenDeployment = await deployments.get('ShutterToken');
  const airdrop = await deployments.get('Airdrop');
  const shutterToken = (await ethers.getContractAt(
    'ShutterToken',
    shutterTokenDeployment.address,
  )) as ShutterToken;

  const predictedSafeAddress = await getPredictedSafeAddress();
  // TODO: change this with the STP address once contract available
  const sptContractAddress = predictedSafeAddress;
  await shutterToken
    .connect(deployer)
    .initialize(predictedSafeAddress, sptContractAddress, airdrop.address);

  console.log('Shutter token initialized');
  console.table({
    newOwner: predictedSafeAddress,
    balanceOwner: ethers.utils.formatEther(await shutterToken.balanceOf(predictedSafeAddress)),
    balanceSptTokenContract: ethers.utils.formatEther(
      await shutterToken.balanceOf(predictedSafeAddress),
    ),
    balanceAirdrop: ethers.utils.formatEther(await shutterToken.balanceOf(airdrop.address)),
    totalMinted: ethers.utils.formatEther(await shutterToken.totalSupply()),
  });

  return true;
};

deployContracts.tags = ['TokenInit'];
deployContracts.dependencies = ['ShutterToken', 'AirDrop'];

deployContracts.id = 'TokenInit';
export default deployContracts;
