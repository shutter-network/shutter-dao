import { keccak256 as hashKeccak256 } from '@ethersproject/keccak256';
import { toUtf8Bytes } from '@ethersproject/strings';
import { pack as solidityPack } from '@ethersproject/solidity';
import { defaultAbiCoder } from '@ethersproject/abi';
import { Vesting } from './types';

const DOMAIN_SEPARATOR_TYPEHASH = hashKeccak256(
  toUtf8Bytes('EIP712Domain(string name,string version)'),
);
const VESTING_TYPEHASH = hashKeccak256(
  toUtf8Bytes(
    'Vesting(address owner,uint8 curveType,bool managed,uint16 durationWeeks,uint64 startDate,uint128 amount,uint128 initialUnlock,bool requiresSPT)',
  ),
);

export const calculateVestingHash = (vesting: Vesting): string => {
  const { owner, curveType, managed, durationWeeks, startDate, amount, initialUnlock, requiresSPT } = vesting;

  const domainSeparator = hashKeccak256(
    defaultAbiCoder.encode(
      ['bytes32', 'string', 'string'],
      [DOMAIN_SEPARATOR_TYPEHASH, 'VestingLibrary', '1.0'],
    ),
  );

  const vestingDataHash = hashKeccak256(
    defaultAbiCoder.encode(
      ['bytes32', 'address', 'uint8', 'bool', 'uint16', 'uint64', 'uint128', 'uint128', 'bool'],
      [
        VESTING_TYPEHASH,
        owner,
        curveType,
        managed,
        durationWeeks,
        startDate,
        amount,
        initialUnlock,
        requiresSPT,
      ],
    ),
  );

  return hashKeccak256(
    solidityPack(
      ['bytes1', 'bytes1', 'bytes32', 'bytes32'],
      [0x19, 0x01, domainSeparator, vestingDataHash],
    ),
  );
};
