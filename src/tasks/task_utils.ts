import { getMasterCopies, getSafeData } from '../../DaoBuilder/daoUtils';

export const getPredictedSafeAddress = async () => {
  const { multisendContract } = await getMasterCopies();

  const { predictedSafeContract } = await getSafeData(multisendContract);
  return predictedSafeContract.address;
};
