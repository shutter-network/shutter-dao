import '@nomiclabs/hardhat-ethers';

import { ethers } from 'hardhat';
import { encodeMultiSend } from '../../DaoBuilder/utils';
import { getMasterCopies, getSafeData } from '../../DaoBuilder/daoUtils';
import { shutterDAOConfig } from '../../config/shutterDAOConfig';
import { AzoriusTxBuilder } from '../../DaoBuilder/AzoriusTxBuilder';
import { ShutterToken } from '../../typechain';
import { getDeploymentArguments } from '../utils/deploy';

const deployContracts = async function ({ deployments, config, network }) {
  const {
    zodiacModuleProxyFactoryContract,
    fractalAzoriusMasterCopyContract,
    fractalRegistryContract,
    keyValuePairContract,
    linearVotingMasterCopyContract,
    multisendContract,
  } = await getMasterCopies();

  const networkName = network.name;
  const safeSalt = getDeploymentArguments<string>('SAFE_SALT', config, networkName);

  const { predictedSafeContract, createSafeTx } = await getSafeData(multisendContract, safeSalt);

  const shutterTokenDeployment = await deployments.get('ShutterToken');
  const shutterTokenContract = (await ethers.getContractAt(
    'ShutterToken',
    shutterTokenDeployment.address,
  )) as ShutterToken;

  const vestingPoolManagerDeployment = await deployments.get('VestingPoolManager');

  //
  // Build Token Voting Contract
  // The Lock Release will act as the Token Voting Strategy
  // The DCNT Token is the Token Voting Token
  const azoriusTxBuilder = new AzoriusTxBuilder(
    shutterDAOConfig,
    predictedSafeContract,
    shutterTokenContract,
    multisendContract,
    zodiacModuleProxyFactoryContract,
    fractalAzoriusMasterCopyContract,
    fractalRegistryContract,
    keyValuePairContract,
    linearVotingMasterCopyContract,
    vestingPoolManagerDeployment.address,
  );

  // Setup Gnosis Safe creation TX
  // With the internal TXs it should run post-deployment
  // As well as the strategy
  // Token Voting module (Azorius)
  const txs = [createSafeTx];
  const internalTxs = [
    azoriusTxBuilder.buildUpdateDAONameTx(),
    azoriusTxBuilder.buildUpdateDAOSnapshotURLTx(),
    azoriusTxBuilder.buildLinearVotingContractSetupTx(),
    azoriusTxBuilder.buildEnableAzoriusModuleTx(),
    azoriusTxBuilder.buildEnableVestingPoolModuleTx(),
    azoriusTxBuilder.buildAddAzoriusContractAsOwnerTx(),
    azoriusTxBuilder.buildRemoveMultiSendOwnerTx(),
  ];
  console.log('Internal safe txs created');

  txs.push(azoriusTxBuilder.buildDeployStrategyTx());
  txs.push(azoriusTxBuilder.buildDeployAzoriusTx());
  txs.push(azoriusTxBuilder.buildExecInternalSafeTx(azoriusTxBuilder.signatures(), internalTxs));
  const encodedTx = encodeMultiSend(txs);

  console.time(`Multisend tx`);
  //
  // Execute all transactions via multisend
  const allTxsMultisendTx = await multisendContract.multiSend(encodedTx, {
    gasLimit: 5000000,
  });
  allTxsMultisendTx.wait();
  console.timeEnd(`Multisend tx`);
  console.log(`Multisend tx executed ${allTxsMultisendTx.hash}`);

  console.table({ daoAddress: predictedSafeContract.address });

  return true;
};

deployContracts.tags = ['DAO'];
deployContracts.dependencies = ['ShutterToken', 'vestingPoolManager'];

deployContracts.id = 'DAO';
export default deployContracts;
