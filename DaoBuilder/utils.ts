/* eslint-disable @typescript-eslint/no-explicit-any */
import { Contract, ethers, BigNumber, utils } from "ethers";
import crypto from "crypto";
import { SafeTransaction, MetaTransaction } from "./types";

// Prefix and postfix strings come from Zodiac contracts
import { ModuleProxyFactory } from "@fractal-framework/fractal-contracts";
import { getCreate2Address, solidityKeccak256 } from "ethers/lib/utils";

const { AddressZero } = ethers.constants;

export const buildContractCall = (
  contract: Contract,
  method: string,
  params: any[],
  nonce: number,
  delegateCall?: boolean,
  overrides?: Partial<SafeTransaction>
): SafeTransaction => {
  const data = contract.interface.encodeFunctionData(method, params);
  return buildSafeTransaction(
    Object.assign(
      {
        to: contract.address,
        data,
        operation: delegateCall ? 1 : 0,
        nonce,
      },
      overrides
    )
  );
};

export const buildSafeTransaction = (template: {
  to: string;
  value?: BigNumber | number | string;
  data?: string;
  operation?: number;
  safeTxGas?: number | string;
  baseGas?: number | string;
  gasPrice?: number | string;
  gasToken?: string;
  refundReceiver?: string;
  nonce: number;
}): SafeTransaction => {
  return {
    to: template.to,
    value: template.value?.toString() || 0,
    data: template.data || "0x",
    operation: template.operation || 0,
    safeTxGas: template.safeTxGas || 0,
    baseGas: template.baseGas || 0,
    gasPrice: template.gasPrice || 0,
    gasToken: template.gasToken || AddressZero,
    refundReceiver: template.refundReceiver || AddressZero,
    nonce: template.nonce,
  };
};

const encodeMetaTransaction = (tx: MetaTransaction): string => {
  const data = utils.arrayify(tx.data);
  const encoded = utils.solidityPack(
    ["uint8", "address", "uint256", "uint256", "bytes"],
    [tx.operation, tx.to, tx.value, data.length, data]
  );
  return encoded.slice(2);
};

export const encodeMultiSend = (txs: MetaTransaction[]): string => {
  return "0x" + txs.map((tx) => encodeMetaTransaction(tx)).join("");
};

export const buildMultiSendSafeTx = (
  multiSend: Contract,
  txs: MetaTransaction[],
  nonce: number,
  overrides?: Partial<SafeTransaction>
): SafeTransaction => {
  return buildContractCall(
    multiSend,
    "multiSend",
    [encodeMultiSend(txs)],
    nonce,
    true,
    overrides
  );
};

export function getRandomBytes(): string {
  const randomBytes = crypto.randomBytes(32);
  const bytes32 = "0x" + randomBytes.toString("hex");
  return bytes32;
}

/**
 * These hardcoded values were taken from
 * @link https://github.com/gnosis/module-factory/blob/master/contracts/ModuleProxyFactory.sol
 */
export const generateContractByteCodeLinear = (
  contractAddress: string
): string => {
  return (
    "0x602d8060093d393df3363d3d373d3d3d363d73" +
    contractAddress +
    "5af43d82803e903d91602b57fd5bf3"
  );
};

export const generateSalt = (calldata: string, saltNum: string): string => {
  return solidityKeccak256(
    ["bytes32", "uint256"],
    [solidityKeccak256(["bytes"], [calldata]), saltNum]
  );
};

export const generatePredictedModuleAddress = (
  zodiacProxyAddress: string,
  salt: string,
  byteCode: string
): string => {
  return getCreate2Address(
    zodiacProxyAddress,
    salt,
    solidityKeccak256(["bytes"], [byteCode])
  );
};

export const buildDeployZodiacModuleTx = (
  zodiacProxyFactoryContract: ModuleProxyFactory,
  params: string[]
): SafeTransaction => {
  return buildContractCall(
    zodiacProxyFactoryContract,
    "deployModule",
    params,
    0,
    false
  );
};
