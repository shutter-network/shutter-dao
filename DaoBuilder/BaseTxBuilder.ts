/* eslint-disable @typescript-eslint/no-explicit-any */
import { buildContractCall, encodeMultiSend } from "./utils";
import { constants, Contract } from "ethers";
import {
  KeyValuePairs,
  FractalRegistry,
  Azorius as IAzorius,
  GnosisSafe,
  ModuleProxyFactory as IModuleProxyFractory,
  LinearERC20Voting,
} from "@fractal-framework/fractal-contracts";
import { ShutterDAOConfig, MetaTransaction, SafeTransaction } from "./types";
import { ShutterToken } from "../typechain";

export class BaseTxBuilder {
  // set base contracts and master copies that are used in the tx
  readonly multiSendContract: Contract;
  readonly predictedSafeContract: GnosisSafe;
  readonly zodiacModuleProxyFactoryContract: IModuleProxyFractory;
  readonly fractalAzoriusMasterCopyContract: IAzorius;
  readonly ShutterTokenContract: ShutterToken;
  readonly fractalRegistryContract: FractalRegistry;
  readonly keyValuePairsContract: KeyValuePairs;
  readonly linearVotingMasterCopyContract: LinearERC20Voting;
  readonly shutterDAOConfig: ShutterDAOConfig;

  constructor(
    predictedSafeContract: GnosisSafe,
    ShutterTokenContract: ShutterToken,
    multiSendContract: Contract,
    zodiacModuleProxyFactoryContract: IModuleProxyFractory,
    fractalAzoriusMasterCopyContract: IAzorius,
    fractalRegistryContract: FractalRegistry,
    keyValuePairsContract: KeyValuePairs,
    linearVotingMasterCopyContract: LinearERC20Voting,
    shutterDAOConfig: ShutterDAOConfig
  ) {
    this.predictedSafeContract = predictedSafeContract;
    this.ShutterTokenContract = ShutterTokenContract;
    this.multiSendContract = multiSendContract;
    this.zodiacModuleProxyFactoryContract = zodiacModuleProxyFactoryContract;
    this.fractalAzoriusMasterCopyContract = fractalAzoriusMasterCopyContract;
    this.fractalRegistryContract = fractalRegistryContract;
    this.keyValuePairsContract = keyValuePairsContract;
    this.linearVotingMasterCopyContract = linearVotingMasterCopyContract;
    this.shutterDAOConfig = shutterDAOConfig;
  }

  buildUpdateDAONameTx(): SafeTransaction {
    return buildContractCall(
      this.fractalRegistryContract,
      "updateDAOName",
      [this.shutterDAOConfig.name],
      0,
      false
    );
  }

  buildUpdateDAOSnapshotURLTx(): SafeTransaction {
    return buildContractCall(
      this.keyValuePairsContract,
      "updateValues",
      [["snapshotURL"], [this.shutterDAOConfig.snapshotURL]], // @todo update
      0,
      false
    );
  }

  buildExecInternalSafeTx(
    signatures: string,
    internalTxs: MetaTransaction[]
  ): SafeTransaction {
    const safeInternalTx = encodeMultiSend(internalTxs);
    return buildContractCall(
      this.predictedSafeContract,
      "execTransaction",
      [
        this.multiSendContract.address, // to
        "0", // value
        this.multiSendContract.interface.encodeFunctionData("multiSend", [
          safeInternalTx,
        ]), // calldata
        "1", // operation
        "0", // tx gas
        "0", // base gas
        "0", // gas price
        constants.AddressZero, // gas token
        constants.AddressZero, // receiver
        signatures, // sigs
      ],
      0,
      false
    );
  }
}
