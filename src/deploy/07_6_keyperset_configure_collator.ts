import '@nomiclabs/hardhat-ethers';

import { ethers } from 'hardhat';
import { shutterDAOConfig } from '../../config/shutterDAOConfig';
import { AddrsSeq, CollatorConfigsList } from '../../typechain';
import {getDeploymentArguments} from "../utils/deploy";
import {getPredictedSafeAddress} from "../../DaoBuilder/daoUtils";

const deployContracts = async function ({ deployments, config, network }) {
  const [deployer] = await ethers.getSigners();

  const safeSalt = getDeploymentArguments<string>('SAFE_SALT', config, network.name);
  const predictedSafeAddress = await getPredictedSafeAddress(safeSalt);

  const collatorDeployment = await deployments.get('Collator');
  const collator = (await ethers.getContractAt('AddrsSeq', collatorDeployment.address)) as AddrsSeq;
  const connectedCollator = collator.connect(deployer);

  await (await connectedCollator.add([shutterDAOConfig.initialKeyperSet.collator])).wait();
  await (await connectedCollator.append()).wait();
  await (await connectedCollator.transferOwnership(predictedSafeAddress)).wait();

  const collatorConfigDeployment = await deployments.get('CollatorConfig');
  const collatorConfig = (await ethers.getContractAt(
    'CollatorConfigsList',
    collatorConfigDeployment.address,
  )) as CollatorConfigsList;
  const connectedCollatorConfig = collatorConfig.connect(deployer);

  await (
    await connectedCollatorConfig.addNewCfg({
      activationBlockNumber: shutterDAOConfig.initialKeyperSet.activationBlock,
      setIndex: 1,
    })
  ).wait();
  await (await connectedCollatorConfig.transferOwnership(predictedSafeAddress)).wait();

  console.log('Collator configured');
  console.table({
    collator: shutterDAOConfig.initialKeyperSet.collator,
    index: 1,
    newOwner: predictedSafeAddress,
  });

  return true;
};

deployContracts.tags = ['ConfigureCollator'];
deployContracts.dependencies = ['Collator', 'CollatorConfig'];
deployContracts.id = 'ConfigureCollator';
export default deployContracts;
