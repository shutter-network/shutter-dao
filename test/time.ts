import { ethers } from "hardhat";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const advanceBlock = async (): Promise<any> => {
  await ethers.provider.send("evm_mine", []);
};

const latest = async (): Promise<number> => {
  const block = await ethers.provider.getBlock("latest");
  return block.timestamp;
};

const increase = async (duration: number): Promise<void> => {
  await increaseTo((await latest()) + duration);
};

const increaseTo = async (to: number): Promise<void> => {
  await ethers.provider.send("evm_setNextBlockTimestamp", [to]);
  await advanceBlock();
};

const duration = {
  seconds: function (val: number): number {
    return val;
  },
  minutes: function (val: number): number {
    return val * this.seconds(60);
  },
  hours: function (val: number): number {
    return val * this.minutes(60);
  },
  days: function (val: number): number {
    return val * this.hours(24);
  },
  weeks: function (val: number): number {
    return val * this.days(7);
  },
  years: function (val: number): number {
    return val * this.days(365);
  },
};

const defaultExport = {
  advanceBlock,
  latest,
  increase,
  increaseTo,
  duration,
};

export default defaultExport;
