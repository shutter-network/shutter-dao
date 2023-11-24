import { expect } from "chai";
import { deployments, ethers, waffle } from "hardhat";
import "@nomiclabs/hardhat-ethers";
import { deployTestToken, getVestingPoolContract } from "../utils/setup";
import { Contract } from "ethers";
import { Vesting } from "../../src/utils/types";
import { calculateVestingHash } from "../../src/utils/hash";

describe("VestingPool - Hash", async () => {

    const [poolManager, user1, user2] = waffle.provider.getWallets();

    const setupTests = deployments.createFixture(async ({ deployments }) => {
        await deployments.fixture();
        const poolContract = await getVestingPoolContract()
        const token = await deployTestToken(poolManager.address)
        const pool = await poolContract.deploy()
        await pool.initialize(token.address, poolManager.address, user1.address)
        return {
            token,
            pool
        }
    })

    const chainId = async () => {
        return (await ethers.provider.getNetwork()).chainId
    }

    const getVestingHash = async(pool: Contract, vesting: Vesting) => {
        // uint8 curveType,
        //   bool managed,
        //   uint16 durationWeeks,
        //   uint64 startDate,
        //   uint128 amount,
        //   uint128 initialUnlock
        return await pool.vestingHash(vesting.curveType, vesting.managed, vesting.durationWeeks, vesting.startDate, vesting.amount, vesting.initialUnlock)
    }

    describe("vestingHash", async () => {

        it('calculate correct hash for managed vesting', async () => {
            const { pool } = await setupTests()
            const vesting: Vesting = {
                curveType: 0,
                managed: true,
                durationWeeks: 104,
                startDate: 1700852771657,
                amount: ethers.utils.parseUnits("200000", 18),
                initialUnlock: ethers.utils.parseUnits("0", 18),
            }
            expect(await getVestingHash(pool, vesting)).to.be.eq(
              calculateVestingHash(pool, vesting, await chainId()),
            );
        })

        it('calculate correct hash for unmanaged vesting', async () => {
            const { pool } = await setupTests()
            const vesting: Vesting = {
                curveType: 0,
                managed: false,
                durationWeeks: 104,
                startDate: (new Date()).getTime(),
                amount: ethers.utils.parseUnits("200000", 18),
                initialUnlock: 0
            }
            expect(
                await getVestingHash(pool, vesting)
            ).to.be.eq(calculateVestingHash(pool, vesting, await chainId()))
        })

        it('calculate correct hash for exponential vesting', async () => {
            const { pool } = await setupTests()
            const vesting: Vesting = {
                curveType: 1,
                managed: true,
                durationWeeks: 104,
                startDate: (new Date()).getTime(),
                amount: ethers.utils.parseUnits("200000", 18),
                initialUnlock: 0
            }
            expect(
                await getVestingHash(pool, vesting)
            ).to.be.eq(calculateVestingHash(pool, vesting, await chainId()))
        })

        it('calculate correct hash for zero amount vesting', async () => {
            const { pool } = await setupTests()
            const vesting: Vesting = {
                curveType: 0,
                managed: true,
                durationWeeks: 104,
                startDate: (new Date()).getTime(),
                amount: 0,
                initialUnlock: 0
            }
            expect(
                await getVestingHash(pool, vesting)
            ).to.be.eq(calculateVestingHash(pool, vesting, await chainId()))
        })
    })
})
