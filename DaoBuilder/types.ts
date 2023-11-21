import type { BigNumber } from 'ethers';

export interface MetaTransaction {
  to: string;
  value: string | number | BigNumber;
  data: string;
  operation: number;
}

export interface SafeTransaction extends MetaTransaction {
  safeTxGas: string | number;
  baseGas: string | number;
  gasPrice: string | number;
  gasToken: string;
  refundReceiver: string;
  nonce: string | number;
}

export interface SafeSignature {
  signer: string;
  data: string;
}

export interface ShutterDAOConfig {
  name: string;
  lockStart: number;
  lockDuration: number;
  snapshotURL: string;
  initialSupply: string;
  votingPeriod: number;
  quorum: number;
  timeLockPeriod: number;
  executionPeriod: number;
  votingBasis: number;
  proposalRequiredWeight: number;
}
