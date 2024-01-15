import '@nomiclabs/hardhat-ethers';

import { ethers } from 'hardhat';
import { shutterDAOConfig } from '../../config/shutterDAOConfig';
import { AddrsSeq, KeypersConfigsList } from '../../typechain';
import {getDeploymentArguments} from "../utils/deploy";
import {getPredictedSafeAddress} from "../../DaoBuilder/daoUtils";

const deployContracts = async function ({ deployments, config, network }) {
  const [deployer] = await ethers.getSigners();

  const safeSalt = getDeploymentArguments<string>('SAFE_SALT', config, network.name);
  const predictedSafeAddress = await getPredictedSafeAddress(safeSalt);

  const keypersDeployment = await deployments.get('Keypers');
  const keypers = (await ethers.getContractAt('AddrsSeq', keypersDeployment.address)) as AddrsSeq;
  const connectedKeypers = keypers.connect(deployer);

  await (await connectedKeypers.add(shutterDAOConfig.initialKeyperSet.keypers)).wait();
  await (await connectedKeypers.append()).wait();
  await (await connectedKeypers.transferOwnership(predictedSafeAddress)).wait();

  const keyperConfigDeployment = await deployments.get('KeyperConfig');
  const keyperConfig = (await ethers.getContractAt(
    'KeypersConfigsList',
    keyperConfigDeployment.address,
  )) as KeypersConfigsList;
  const connectedKeyperConfig = keyperConfig.connect(deployer);

  const threshold = Math.ceil(
    shutterDAOConfig.initialKeyperSet.keypers.length *
      shutterDAOConfig.initialKeyperSet.thresholdRatio,
  );
  await (
    await connectedKeyperConfig.addNewCfg({
      activationBlockNumber: shutterDAOConfig.initialKeyperSet.activationBlock,
      setIndex: 1,
      threshold,
    })
  ).wait();
  await (await connectedKeyperConfig.transferOwnership(predictedSafeAddress)).wait();

  console.log('Keypers configured');
  console.table(shutterDAOConfig.initialKeyperSet.keypers);
  console.table({
    setIndex: 1,
    threshold,
    newOwner: predictedSafeAddress,
  });

  return true;
};

deployContracts.tags = ['ConfigureKeypers'];
deployContracts.dependencies = ['Keypers', 'KeyperConfig'];
deployContracts.id = 'ConfigureKeypers';
export default deployContracts;
