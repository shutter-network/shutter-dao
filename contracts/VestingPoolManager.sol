/// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity >=0.8.22 <0.9.0;

import { Clones } from "@openzeppelin/contracts/proxy/Clones.sol";
import { VestingPool } from "./VestingPool.sol";
import { ModuleManager } from "./interfaces/ModuleManager.sol";
import { ShutterToken } from "./ShutterToken.sol";

/// @title Vesting Pool Manager
/// @author Daniel Dimitrov - @compojoom, Fred Lührs - @fredo
contract VestingPoolManager {
    // Mapping of user address to vesting pool address
    mapping(address => address) private userToVestingPool;

    // Address of the vesting pool implementation
    address public immutable vestingPoolImplementation;
    ShutterToken public immutable token;
    address public immutable dao;

    modifier onlyDao() {
        require(msg.sender == dao, "Can only be called by pool manager");
        _;
    }

    constructor(
        address _token,
        address _vestingPoolImplementation,
        address _dao
    ) {
        token = ShutterToken(_token);
        vestingPoolImplementation = _vestingPoolImplementation;
        dao = _dao;
    }

    /// @notice Creates a vesting pool for the user
    /// @param user The user for which the vesting pool should be created
    function addVestingPool(address user) private returns (address) {
        require(user != address(0), "Invalid user address");
        require(
            userToVestingPool[user] == address(0),
            "Vesting pool already exists for the user"
        );

        address vestingPool = Clones.clone(vestingPoolImplementation);

        VestingPool(vestingPool).initialize(
            address(token),
            address(this),
            user
        );

        userToVestingPool[user] = vestingPool;

        return vestingPool;
    }

    /// @notice Get the vesting pool for the user or revert if it does not exist
    /// @param user The user for which the vesting pool address should be returned
    /// @return The vesting pool address for the user
    function getVestingPool(address user) public view returns (address) {
        address vestingPool = userToVestingPool[user];
        require(vestingPool != address(0), "Vesting pool does not exist");
        return vestingPool;
    }

    /// @notice Add a vesting to the vesting pool of the user
    /// @param account The user for which the vesting should be added
    /// @param curveType Type of the curve that should be used for the vesting
    /// @param managed Whether the vesting should be managed or not
    /// @param durationWeeks The duration of the vesting in weeks
    /// @param startDate The date when the vesting should be started (can be in the past)
    /// @param amount Amount of tokens that should be vested in wei
    /// @param initialUnlock Amount of tokens that should be unlocked initially in wei
    /// @return The id of the vesting that was created
    function addVesting(
        address account,
        uint8 curveType,
        bool managed,
        uint16 durationWeeks,
        uint64 startDate,
        uint128 amount,
        uint128 initialUnlock
    ) external returns (bytes32) {
        address vestingPool = userToVestingPool[account];

        if (vestingPool == address(0)) {
            vestingPool = addVestingPool(account);
        }

        if (token.paused()) {
            transferViaModule(account, amount);
        } else {
            token.transferFrom(msg.sender, vestingPool, amount);
        }

        return
            VestingPool(vestingPool).addVesting(
                curveType,
                managed,
                durationWeeks,
                startDate,
                amount,
                initialUnlock
            );
    }

    /// @notice If the token is paused, this will transfer the tokens via to the
    /// user's pool by using a Safe module transaction
    function transferViaModule(address account, uint128 amount) private {
        address vestingPool = getVestingPool(account);
        // Build transfer data to call token contract via the pool manager
        bytes memory transferData = abi.encodeWithSignature(
            "transferFrom(address,address,uint256)",
            msg.sender,
            vestingPool,
            amount
        );
        // Trigger transfer of tokens from this pool to the beneficiary via the pool manager as a module transaction
        require(
            ModuleManager(dao).execTransactionFromModule(
                address(token),
                0,
                transferData,
                0
            ),
            "Module transaction failed"
        );
    }

    /// @notice cancel a vesting
    /// @param account The user for which the vesting should be canceled
    /// @param vestingId The id of the vesting that should be canceled
    function cancelVesting(
        address account,
        bytes32 vestingId
    ) external onlyDao {
        address vestingPool = getVestingPool(account);

        VestingPool(vestingPool).cancelVesting(vestingId);
    }

    /// @notice pause a vesting
    /// @param account The user for which the vesting should be paused
    /// @param vestingId The id of the vesting that should be paused
    function pauseVesting(address account, bytes32 vestingId) public onlyDao {
        address vestingPool = getVestingPool(account);

        VestingPool(vestingPool).pauseVesting(vestingId);
    }

    /// @notice unpause a vesting
    /// @param account The user for which the vesting should be unpaused
    /// @param vestingId The id of the vesting that should be unpaused
    function unpauseVesting(address account, bytes32 vestingId) public onlyDao {
        address vestingPool = getVestingPool(account);

        VestingPool(vestingPool).unpauseVesting(vestingId);
    }
}
