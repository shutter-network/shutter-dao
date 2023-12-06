import { logShutterDaoTxt, logEthereumLogo } from './graphics/graphics';
import { ethers } from 'hardhat';
import { getMasterCopies, getSafeData } from '../DaoBuilder/daoUtils';
import { AzoriusTxBuilder } from '../DaoBuilder/AzoriusTxBuilder';
import { shutterDAOConfig } from '../config/shutterDAOConfig';
import { encodeMultiSend } from '../DaoBuilder/utils';
import { utils } from 'ethers';

async function createDAO() {
  logShutterDaoTxt();

  const [deployer] = await ethers.getSigners();
  const shutterTokenFactory = await ethers.getContractFactory('ShutterToken');
  const shutterTokenContract = await shutterTokenFactory.deploy(await deployer.getAddress());

  //
  // Get predicted safe deployment address + transaction
  // This transaction will deploy a new Gnosis safe
  const {
    zodiacModuleProxyFactoryContract,
    fractalAzoriusMasterCopyContract,
    fractalRegistryContract,
    keyValuePairContract,
    linearVotingMasterCopyContract,
    multisendContract,
  } = await getMasterCopies();

  const { predictedSafeContract, createSafeTx } = await getSafeData(multisendContract);

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
  );

  //
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

  //
  // Transfer remaining unlocked DCNT supply to the DAO
  // This is equal to total DCNT supply minus tokens held in lock contract
  const amountToTransfer = utils.parseEther(shutterDAOConfig.initialSupply);
  const tokenTransfer = await shutterTokenContract.transfer(
    predictedSafeContract.address,
    amountToTransfer,
  );
  // await tokenTransfer.wait();

  console.log('Shutter Tokens transferred to Shutter DAO:');
  console.table({
    amountToTransfer: ethers.utils.formatEther(amountToTransfer),
    hash: tokenTransfer.hash,
  });

  //
  // Transfer ownership of the Shutter Token
  // To the Shutter DAO
  const transferTokenOwnership = await shutterTokenContract.transferOwnership(
    predictedSafeContract.address,
  );
  await transferTokenOwnership.wait();
  console.log('Shutter Token ownership transferred to Shutter DAO:');
  console.table({
    dao: predictedSafeContract.address,
    hash: transferTokenOwnership.hash,
  });

  const VestingLibrary = await ethers.getContractFactory('VestingLibrary');
  const vestingLibrary = await VestingLibrary.deploy();
  await vestingLibrary.deployed();

  const VestingPool = await ethers.getContractFactory('VestingPool', {
    libraries: {
      VestingLibrary: vestingLibrary.address,
    },
  });

  const vestingPool = await VestingPool.deploy();
  await vestingPool.deployed();

  const VestingPoolManager = await ethers.getContractFactory('VestingPoolManager');
  const vestingPoolManager = await VestingPoolManager.deploy(
    shutterTokenContract.address,
    vestingPool.address,
    predictedSafeContract.address,
  );
  await vestingPoolManager.deployed();

  // TODO: make this configurable
  const airdropRedeemDeadline = 1735689600;
  const Airdrop = await ethers.getContractFactory('Airdrop');
  const airdrop = await Airdrop.deploy(
    shutterTokenContract.address,
    predictedSafeContract.address,
    airdropRedeemDeadline,
    vestingPoolManager.address,
  );
  await airdrop.deployed();

  console.log('VestingLibrary, VestingPool, VestingPoolManager, Airdrop deployed successfully:');
  console.table({
    vestingLibrary: vestingLibrary.address,
    vestingPool: vestingPool.address,
    vestingManager: vestingPoolManager.address,
    airdrop: airdrop.address,
  });

  logEthereumLogo();
}

createDAO()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
