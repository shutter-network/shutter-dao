/// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity >=0.8.22 <0.9.0;

library VestingLibrary {
    bytes32 private constant DOMAIN_SEPARATOR_TYPEHASH =
        keccak256("EIP712Domain(string name,string version)");

    bytes32 private constant VESTING_TYPEHASH =
        keccak256(
            "Vesting(address owner,uint8 curveType,bool managed,uint16 durationWeeks,uint64 startDate,uint128 amount,uint128 initialUnlock)"
        );

    // Sane limits based on: https://eips.ethereum.org/EIPS/eip-1985
    // amountClaimed should always be equal to or less than amount
    // pausingDate should always be equal to or greater than startDate
    struct Vesting {
        // First storage slot
        uint128 initialUnlock; // 16 bytes -> Max 3.4e20 tokens (including decimals)
        uint8 curveType; // 1 byte -> Max 256 different curve types
        bool managed; // 1 byte
        uint16 durationWeeks; // 2 bytes -> Max 65536 weeks ~ 1260 years
        uint64 startDate; // 8 bytes -> Works until year 292278994, but not before 1970
        // Second storage slot
        uint128 amount; // 16 bytes -> Max 3.4e20 tokens (including decimals)
        uint128 amountClaimed; // 16 bytes -> Max 3.4e20 tokens (including decimals)
        // Third storage slot
        uint64 pausingDate; // 8 bytes -> Works until year 292278994, but not before 1970
        bool cancelled; // 1 byte
    }

    /// @notice Calculate the id for a vesting based on its parameters.
    /// @param owner The owner for which the vesting was created
    /// @param curveType Type of the curve that is used for the vesting
    /// @param managed Indicator if the vesting is managed by the pool manager
    /// @param durationWeeks The duration of the vesting in weeks
    /// @param startDate The date when the vesting started (can be in the future)
    /// @param amount Amount of tokens that are vested in atoms
    /// @param initialUnlock Amount of tokens that are unlocked immediately in atoms
    /// @return vestingId Id of a vesting based on its parameters
    function vestingHash(
        address owner,
        uint8 curveType,
        bool managed,
        uint16 durationWeeks,
        uint64 startDate,
        uint128 amount,
        uint128 initialUnlock
    ) external pure returns (bytes32 vestingId) {
        bytes32 domainSeparator = keccak256(
            abi.encode(DOMAIN_SEPARATOR_TYPEHASH, "VestingLibrary", "1.0")
        );
        bytes32 vestingDataHash = keccak256(
            abi.encode(
                VESTING_TYPEHASH,
                owner,
                curveType,
                managed,
                durationWeeks,
                startDate,
                amount,
                initialUnlock
            )
        );
        vestingId = keccak256(
            abi.encodePacked(
                bytes1(0x19),
                bytes1(0x01),
                domainSeparator,
                vestingDataHash
            )
        );
    }
}
