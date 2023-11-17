/* eslint-disable @typescript-eslint/no-explicit-any */
import { SafeTransaction } from "./types";
import { buildContractCall, getRandomBytes } from "./utils";
import { Contract } from "ethers";
import { ethers, network } from "hardhat";
import {
  GnosisSafeProxyFactory__factory as GnosisSafeFactory,
  Azorius as IAzorius,
  ModuleProxyFactory as IModuleProxyFractory,
  LinearERC20Voting as ILinearERC20Voting,
  KeyValuePairs as IKeyValuePairs,
  FractalRegistry as IFractalRegistry,
  GnosisSafe,
  GnosisSafeProxyFactory,
} from "@fractal-framework/fractal-contracts";
import { getCreate2Address, solidityKeccak256 } from "ethers/lib/utils";
import {
  getMultiSendCallOnlyDeployment,
  getProxyFactoryDeployment,
  getSafeSingletonDeployment,
} from "@safe-global/safe-deployments";
const { AddressZero, HashZero } = ethers.constants;

export const SAFE_VERSION = "1.3.0";

/* eslint-disable node/no-unsupported-features/es-syntax */
async function getFractalContractAddressesByNetworkName() {
  const contractsPath = `@fractal-framework/fractal-contracts/deployments/${network.name}`;

  const Azorius = await import(
    `${contractsPath}/Azorius.json`
  );
  const FractalRegistry = await import(
    `${contractsPath}/FractalRegistry.json`
  );
  const KeyValuePairs = await import(
    `${contractsPath}/KeyValuePairs.json`
  );
  const LinearERC20Voting = await import(
    `${contractsPath}/LinearERC20Voting.json`
  );
  const ModuleProxyFactory = await import(
    `${contractsPath}/ModuleProxyFactory.json`
  );
  return {
    Azorius,
    FractalRegistry,
    KeyValuePairs,
    LinearERC20Voting,
    ModuleProxyFactory,
  };
}
/* eslint-enable node/no-unsupported-features/es-syntax */

export const getMasterCopies = async (): Promise<{
  zodiacModuleProxyFactoryContract: IModuleProxyFractory;
  fractalAzoriusMasterCopyContract: IAzorius;
  fractalRegistryContract: IFractalRegistry;
  linearVotingMasterCopyContract: ILinearERC20Voting;
  keyValuePairContract: IKeyValuePairs;
  multisendContract: Contract;
}> => {
  if (!network.config.chainId) {
    throw Error(`No chain ID found for: ${network.name}`)
  }

  const {
    Azorius,
    FractalRegistry,
    KeyValuePairs,
    LinearERC20Voting,
    ModuleProxyFactory,
  } = await getFractalContractAddressesByNetworkName();

  const zodiacModuleProxyFactoryContract = (await ethers.getContractAt(
    ModuleProxyFactory.abi as Record<string, any>[],
    ModuleProxyFactory.address
  )) as IModuleProxyFractory;

  const fractalAzoriusMasterCopyContract = (await ethers.getContractAt(
    Azorius.abi,
    Azorius.address
  )) as IAzorius;

  const linearVotingMasterCopyContract = (await ethers.getContractAt(
    LinearERC20Voting.abi,
    LinearERC20Voting.address
  )) as ILinearERC20Voting;

  const fractalRegistryContract = (await ethers.getContractAt(
    FractalRegistry.abi as Record<string, any>[],
    FractalRegistry.address
  )) as IFractalRegistry;

  const keyValuePairContract = (await ethers.getContractAt(
    KeyValuePairs.abi as Record<string, any>[],
    KeyValuePairs.address
  )) as IKeyValuePairs;

  const multisendSingletonDeployment = getMultiSendCallOnlyDeployment({
    version: SAFE_VERSION,
    network: network.config.chainId.toString(),
  });
  if (!multisendSingletonDeployment)
    throw new Error("Multisend contract not found");

  const multisendContract = await ethers.getContractAt(
    multisendSingletonDeployment.abi,
    multisendSingletonDeployment.defaultAddress
  );

  console.log("Master copies fetched");
  console.table({
    zodiacModuleProxyFactoryContract: zodiacModuleProxyFactoryContract.address,
    fractalAzoriusMasterCopyContract: fractalAzoriusMasterCopyContract.address,
    fractalRegistryContract: fractalRegistryContract.address,
    keyValuePairContract: keyValuePairContract.address,
    linearVotingMasterCopyContract: linearVotingMasterCopyContract.address,
    multisendContract: multisendContract.address,
  });

  return {
    multisendContract,
    zodiacModuleProxyFactoryContract,
    fractalAzoriusMasterCopyContract,
    fractalRegistryContract,
    keyValuePairContract,
    linearVotingMasterCopyContract,
  };
};

export const getSafeData = async (
  multiSendContract: Contract
): Promise<{
  predictedSafeContract: GnosisSafe;
  createSafeTx: SafeTransaction;
}> => {
  if (!network.config.chainId) {
    throw Error(`No chain ID found for: ${network.name}`)
  }

  const gnosisFactory = getProxyFactoryDeployment({
    version: SAFE_VERSION,
    network: network.config.chainId.toString(),
  });
  if (!gnosisFactory) throw new Error("Gnosis factory not found");

  const saltNum = getRandomBytes();

  const gnosisSafeFactoryContract = (await ethers.getContractAt(
    GnosisSafeFactory.abi,
    gnosisFactory.defaultAddress
  )) as GnosisSafeProxyFactory;

  const gnosisSingleton = getSafeSingletonDeployment({
    version: SAFE_VERSION,
    network: network.config.chainId.toString(),
  });

  if (!gnosisSingleton) throw new Error("Gnosis singleton not found");

  const gnosisSafeSingletonContract = (await ethers.getContractAt(
    gnosisSingleton.abi,
    gnosisSingleton.defaultAddress
  )) as GnosisSafe;

  // multisend contract is the only signer; this is removed later
  const signers = [multiSendContract.address];

  const createGnosisCalldata =
    gnosisSafeSingletonContract.interface.encodeFunctionData("setup", [
      signers,
      1, // threshold
      AddressZero,
      HashZero,
      AddressZero,
      AddressZero,
      0,
      AddressZero,
    ]);

  const predictedGnosisSafeAddress = getCreate2Address(
    gnosisSafeFactoryContract.address,
    solidityKeccak256(
      ["bytes", "uint256"],
      [solidityKeccak256(["bytes"], [createGnosisCalldata]), saltNum]
    ),
    solidityKeccak256(
      ["bytes", "uint256"],
      [
        await gnosisSafeFactoryContract.proxyCreationCode(),
        gnosisSafeSingletonContract.address,
      ]
    )
  );

  const createSafeTx = buildContractCall(
    gnosisSafeFactoryContract,
    "createProxyWithNonce",
    [gnosisSafeSingletonContract.address, createGnosisCalldata, saltNum],
    0,
    false
  );

  const predictedSafeContract = gnosisSafeSingletonContract.attach(
    predictedGnosisSafeAddress
  );

  return { predictedSafeContract, createSafeTx };
};
