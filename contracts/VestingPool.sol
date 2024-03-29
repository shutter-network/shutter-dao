// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity >=0.8.22 <0.9.0;

import { ERC20Votes } from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Votes.sol";
import { VestingLibrary } from "./libraries/VestingLibrary.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @title Vesting contract for single account
/// Original contract - https://github.com/safe-global/safe-token/blob/main/contracts/VestingPool.sol
/// @author Daniel Dimitrov - @compojoom, Fred Lührs - @fredo
contract VestingPool {
    event AddedVesting(bytes32 indexed id);
    event ClaimedVesting(bytes32 indexed id, address indexed beneficiary);
    event PausedVesting(bytes32 indexed id);
    event UnpausedVesting(bytes32 indexed id);
    event CancelledVesting(bytes32 indexed id);

    bool public initialised;
    address public owner;

    address public token;
    address public immutable sptToken;
    address public poolManager;

    uint256 public totalTokensInVesting;
    mapping(bytes32 => VestingLibrary.Vesting) public vestings;

    modifier onlyPoolManager() {
        require(
            msg.sender == poolManager,
            "Can only be called by pool manager"
        );
        _;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "Can only be claimed by vesting owner");
        _;
    }

    // solhint-disable-next-line no-empty-blocks
    constructor(address _sptToken) {
        sptToken = _sptToken;
        // don't do anything else here to allow usage of proxy contracts.
    }

    /// @notice Initialize the vesting pool
    /// @dev This can only be called once
    /// @param _token The token that should be used for the vesting
    /// @param _poolManager The manager of this vesting pool (e.g. the address that can call `addVesting`)
    /// @param _owner The owner of this vesting pool (e.g. the address that can call `delegateTokens`)
    function initialize(
        address _token,
        address _poolManager,
        address _owner
    ) public {
        require(!initialised, "The contract has already been initialised.");
        require(_token != address(0), "Invalid token account");
        require(_poolManager != address(0), "Invalid pool manager account");
        require(_owner != address(0), "Invalid account");

        initialised = true;

        token = _token;
        poolManager = _poolManager;

        owner = _owner;
    }

    function delegateTokens(address delegatee) external onlyOwner {
        ERC20Votes(token).delegate(delegatee);
    }

    /// @notice Create a vesting on this pool for `account`.
    /// @dev This can only be called by the pool manager
    /// @dev It is required that the pool has enough tokens available
    /// @param curveType Type of the curve that should be used for the vesting
    /// @param managed Boolean that indicates if the vesting can be managed by the pool manager
    /// @param durationWeeks The duration of the vesting in weeks
    /// @param startDate The date when the vesting should be started (can be in the past)
    /// @param amount Amount of tokens that should be vested in atoms
    /// @param initialUnlock Amount of tokens that should be unlocked immediately
    /// @return vestingId The id of the created vesting
    function addVesting(
        uint8 curveType,
        bool managed,
        uint16 durationWeeks,
        uint64 startDate,
        uint128 amount,
        uint128 initialUnlock,
        bool requiresSPT
    ) public virtual onlyPoolManager returns (bytes32) {
        return
            _addVesting(
                curveType,
                managed,
                durationWeeks,
                startDate,
                amount,
                initialUnlock,
                requiresSPT
            );
    }

    /// @notice Calculate the amount of tokens available for new vestings.
    /// @dev This value changes when more tokens are deposited to this contract
    /// @return Amount of tokens that can be used for new vestings.
    function tokensAvailableForVesting() public view virtual returns (uint256) {
        return
            ERC20Votes(token).balanceOf(address(this)) - totalTokensInVesting;
    }

    /// @notice Create a vesting on this pool for `account`.
    /// @dev It is required that the pool has enough tokens available
    /// @dev Account cannot be zero address
    /// @param curveType Type of the curve that should be used for the vesting
    /// @param managed Boolean that indicates if the vesting can be managed by the pool manager
    /// @param durationWeeks The duration of the vesting in weeks
    /// @param startDate The date when the vesting should be started (can be in the past)
    /// @param amount Amount of tokens that should be vested in atoms
    /// @param vestingId The id of the created vesting
    function _addVesting(
        uint8 curveType,
        bool managed,
        uint16 durationWeeks,
        uint64 startDate,
        uint128 amount,
        uint128 initialUnlock,
        bool requiresSPT
    ) internal returns (bytes32 vestingId) {
        require(curveType < 2, "Invalid vesting curve");
        vestingId = VestingLibrary.vestingHash(
            owner,
            curveType,
            managed,
            durationWeeks,
            startDate,
            amount,
            initialUnlock,
            requiresSPT
        );
        require(vestings[vestingId].amount == 0, "Vesting id already used");
        // Check that enough tokens are available for the new vesting
        uint256 availableTokens = tokensAvailableForVesting();
        require(availableTokens >= amount, "Not enough tokens available");
        // Mark tokens for this vesting in use
        totalTokensInVesting += amount;
        vestings[vestingId] = VestingLibrary.Vesting({
            curveType: curveType,
            managed: managed,
            durationWeeks: durationWeeks,
            startDate: startDate,
            amount: amount,
            amountClaimed: 0,
            pausingDate: 0,
            cancelled: false,
            initialUnlock: initialUnlock,
            requiresSPT: requiresSPT
        });
        emit AddedVesting(vestingId);
    }

    /// @notice Claim `tokensToClaim` tokens from vesting `vestingId` and transfer them to the `beneficiary`.
    /// @dev This can only be called by the owner of the vesting
    /// @dev Beneficiary cannot be the 0-address
    /// @dev This will trigger a transfer of tokens
    /// @param vestingId Id of the vesting from which the tokens should be claimed
    /// @param beneficiary Account that should receive the claimed tokens
    /// @param tokensToClaim Amount of tokens to claim in atoms or max uint128 to claim all available
    function claimVestedTokens(
        bytes32 vestingId,
        address beneficiary,
        uint128 tokensToClaim
    ) public {
        VestingLibrary.Vesting storage vesting = vestings[vestingId];
        require(vesting.amount != 0, "Vesting not found");

        uint128 tokensClaimed = updateClaimedTokens(
            vestingId,
            beneficiary,
            tokensToClaim
        );

        if(vesting.requiresSPT) {
           require(
                IERC20(sptToken).transferFrom(msg.sender, address(this), tokensClaimed),
                "SPT transfer failed"
            );
        }

        require(
            ERC20Votes(token).transfer(beneficiary, tokensClaimed),
            "Token transfer failed"
        );
    }

    /// @notice Update `amountClaimed` on vesting `vestingId` by `tokensToClaim` tokens.
    /// @dev This can only be called by the owner of the vesting
    /// @dev Beneficiary cannot be the 0-address
    /// @dev This will only update the internal state and NOT trigger the transfer of tokens.
    /// @param vestingId Id of the vesting from which the tokens should be claimed
    /// @param beneficiary Account that should receive the claimed tokens
    /// @param tokensToClaim Amount of tokens to claim in atoms or max uint128 to claim all available
    /// @param tokensClaimed Amount of tokens that have been newly claimed by calling this method
    function updateClaimedTokens(
        bytes32 vestingId,
        address beneficiary,
        uint128 tokensToClaim
    ) internal onlyOwner returns (uint128 tokensClaimed) {
        require(beneficiary != address(0), "Cannot claim to 0-address");
        VestingLibrary.Vesting storage vesting = vestings[vestingId];
        // Calculate how many tokens can be claimed
        uint128 availableClaim = _calculateVestedAmount(vesting) -
            vesting.amountClaimed;
        // If max uint128 is used, claim all available tokens.
        tokensClaimed = tokensToClaim == type(uint128).max
            ? availableClaim
            : tokensToClaim;
        require(
            tokensClaimed <= availableClaim,
            "Trying to claim too many tokens"
        );
        // Adjust how many tokens are locked in vesting
        totalTokensInVesting -= tokensClaimed;
        vesting.amountClaimed += tokensClaimed;
        emit ClaimedVesting(vestingId, beneficiary);
    }

    /// @notice Cancel vesting `vestingId`.
    /// @dev This can only be called by the pool manager
    /// @dev Only manageable vestings can be cancelled
    /// @param vestingId Id of the vesting that should be cancelled
    function cancelVesting(bytes32 vestingId) public onlyPoolManager {
        VestingLibrary.Vesting storage vesting = vestings[vestingId];
        require(vesting.amount != 0, "Vesting not found");
        require(vesting.managed, "Only managed vestings can be cancelled");
        require(!vesting.cancelled, "Vesting already cancelled");
        bool isFutureVesting = block.timestamp <= vesting.startDate;
        // If vesting is not already paused it will be paused
        // Pausing date should not be reset else tokens of the initial pause can be claimed
        if (vesting.pausingDate == 0) {
            // pausingDate should always be larger or equal to startDate
            vesting.pausingDate = isFutureVesting
                ? vesting.startDate
                : uint64(block.timestamp);
        }
        // Vesting is cancelled, therefore tokens that are not vested yet, will be added back to the pool
        uint128 unusedToken = isFutureVesting
            ? vesting.amount
            : vesting.amount - _calculateVestedAmount(vesting);
        totalTokensInVesting -= unusedToken;
        // Vesting is set to cancelled and therefore disallows unpausing
        vesting.cancelled = true;
        emit CancelledVesting(vestingId);
    }

    /// @notice Pause vesting `vestingId`.
    /// @dev This can only be called by the pool manager
    /// @dev Only manageable vestings can be paused
    /// @param vestingId Id of the vesting that should be paused
    function pauseVesting(bytes32 vestingId) public onlyPoolManager {
        VestingLibrary.Vesting storage vesting = vestings[vestingId];
        require(vesting.amount != 0, "Vesting not found");
        require(vesting.managed, "Only managed vestings can be paused");
        require(vesting.pausingDate == 0, "Vesting already paused");
        // pausingDate should always be larger or equal to startDate
        vesting.pausingDate = block.timestamp <= vesting.startDate
            ? vesting.startDate
            : uint64(block.timestamp);
        emit PausedVesting(vestingId);
    }

    /// @notice Unpause vesting `vestingId`.
    /// @dev This can only be called by the pool manager
    /// @dev Only vestings that have not been cancelled can be unpaused
    /// @param vestingId Id of the vesting that should be unpaused
    function unpauseVesting(bytes32 vestingId) public onlyPoolManager {
        VestingLibrary.Vesting storage vesting = vestings[vestingId];
        require(vesting.amount != 0, "Vesting not found");
        require(vesting.pausingDate != 0, "Vesting is not paused");
        require(
            !vesting.cancelled,
            "Vesting has been cancelled and cannot be unpaused"
        );
        // Calculate the time the vesting was paused
        // If vesting has not started yet, then pausing date might be in the future
        uint64 timePaused = block.timestamp <= vesting.pausingDate
            ? 0
            : uint64(block.timestamp) - vesting.pausingDate;
        // Offset the start date to create the effect of pausing
        vesting.startDate = vesting.startDate + timePaused;
        vesting.pausingDate = 0;
        emit UnpausedVesting(vestingId);
    }

    /// @notice Calculate vested and claimed token amounts for vesting `vestingId`.
    /// @dev This will revert if the vesting has not been started yet
    /// @param vestingId Id of the vesting for which to calculate the amounts
    /// @return vestedAmount The amount in atoms of tokens vested
    /// @return claimedAmount The amount in atoms of tokens claimed
    function calculateVestedAmount(
        bytes32 vestingId
    ) external view returns (uint128 vestedAmount, uint128 claimedAmount) {
        VestingLibrary.Vesting storage vesting = vestings[vestingId];
        require(vesting.amount != 0, "Vesting not found");
        vestedAmount = _calculateVestedAmount(vesting);
        claimedAmount = vesting.amountClaimed;
    }

    /// @notice Calculate vested token amount for vesting `vesting`.
    /// @dev This will revert if the vesting has not been started yet
    /// @param vesting The vesting for which to calculate the amounts
    /// @return vestedAmount The amount in atoms of tokens vested
    function _calculateVestedAmount(
        VestingLibrary.Vesting storage vesting
    ) internal view returns (uint128 vestedAmount) {
        require(vesting.startDate <= block.timestamp, "Vesting not active yet");
        // Convert vesting duration to seconds
        uint64 durationSeconds = uint64(vesting.durationWeeks) *
            7 *
            24 *
            60 *
            60;
        // If contract is paused use the pausing date to calculate amount
        uint64 vestedSeconds = vesting.pausingDate > 0
            ? vesting.pausingDate - vesting.startDate
            : uint64(block.timestamp) - vesting.startDate;
        if (vestedSeconds >= durationSeconds) {
            // If vesting time is longer than duration everything has been vested
            vestedAmount = vesting.amount;
        } else if (vesting.curveType == 0) {
            // Linear vesting
            vestedAmount =
                calculateLinear(
                    vesting.amount - vesting.initialUnlock,
                    vestedSeconds,
                    durationSeconds
                ) +
                vesting.initialUnlock;
        } else if (vesting.curveType == 1) {
            // Exponential vesting
            vestedAmount =
                calculateExponential(
                    vesting.amount - vesting.initialUnlock,
                    vestedSeconds,
                    durationSeconds
                ) +
                vesting.initialUnlock;
        } else {
            // This is unreachable because it is not possible to add a vesting with an invalid curve type
            revert("Invalid curve type");
        }
    }

    /// @notice Calculate vested token amount on a linear curve.
    /// @dev Calculate vested amount on linear curve: targetAmount * elapsedTime / totalTime
    /// @param targetAmount Amount of tokens that is being vested
    /// @param elapsedTime Time that has elapsed for the vesting
    /// @param totalTime Duration of the vesting
    /// @return Tokens that have been vested on a linear curve
    function calculateLinear(
        uint128 targetAmount,
        uint64 elapsedTime,
        uint64 totalTime
    ) internal pure returns (uint128) {
        // Calculate vested amount on linear curve: targetAmount * elapsedTime / totalTime
        uint256 amount = (uint256(targetAmount) * uint256(elapsedTime)) /
            uint256(totalTime);
        require(amount <= type(uint128).max, "Overflow in curve calculation");
        return uint128(amount);
    }

    /// @notice Calculate vested token amount on an exponential curve.
    /// @dev Calculate vested amount on exponential curve: targetAmount * elapsedTime^2 / totalTime^2
    /// @param targetAmount Amount of tokens that is being vested
    /// @param elapsedTime Time that has elapsed for the vesting
    /// @param totalTime Duration of the vesting
    /// @return Tokens that have been vested on an exponential curve
    function calculateExponential(
        uint128 targetAmount,
        uint64 elapsedTime,
        uint64 totalTime
    ) internal pure returns (uint128) {
        // Calculate vested amount on exponential curve: targetAmount * elapsedTime^2 / totalTime^2
        uint256 amount = (uint256(targetAmount) *
            uint256(elapsedTime) *
            uint256(elapsedTime)) / (uint256(totalTime) * uint256(totalTime));
        require(amount <= type(uint128).max, "Overflow in curve calculation");
        return uint128(amount);
    }
}
