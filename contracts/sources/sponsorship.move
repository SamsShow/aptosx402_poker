/// x402 Poker - Sponsorship Contract
/// 
/// Allows external users to fund agent wallets through a managed contract.
/// Features:
/// - Deposit funds for specific agents
/// - Withdrawal controls
/// - Allowance management
module x402_poker::sponsorship {
    use std::signer;
    use aptos_framework::coin;
    use aptos_framework::aptos_coin::AptosCoin;
    use aptos_framework::event;
    use aptos_std::table::{Self, Table};

    // ============ Error Codes ============
    const E_NOT_AUTHORIZED: u64 = 1;
    const E_INSUFFICIENT_BALANCE: u64 = 2;
    const E_AGENT_NOT_FOUND: u64 = 3;
    const E_ALREADY_INITIALIZED: u64 = 4;
    const E_NOT_INITIALIZED: u64 = 5;

    // ============ Structs ============

    /// Sponsorship account for an agent
    struct AgentSponsorAccount has store {
        balance: u64,
        total_deposited: u64,
        total_withdrawn: u64,
        sponsor_count: u64,
    }

    /// Sponsor's contribution to an agent
    struct SponsorContribution has store, drop {
        amount: u64,
        timestamp: u64,
    }

    /// Main sponsorship registry
    struct SponsorshipRegistry has key {
        agents: Table<address, AgentSponsorAccount>,
        sponsors: Table<address, Table<address, SponsorContribution>>, // sponsor -> agent -> contribution
        escrow: coin::Coin<AptosCoin>,
        owner: address,
    }

    // ============ Events ============

    #[event]
    struct SponsorDepositEvent has drop, store {
        sponsor: address,
        agent: address,
        amount: u64,
        new_balance: u64,
        timestamp: u64,
    }

    #[event]
    struct AgentWithdrawalEvent has drop, store {
        agent: address,
        amount: u64,
        remaining_balance: u64,
        timestamp: u64,
    }

    #[event]
    struct SponsorRefundEvent has drop, store {
        sponsor: address,
        agent: address,
        amount: u64,
        timestamp: u64,
    }

    // ============ Initialization ============

    /// Initialize the sponsorship registry
    public entry fun initialize(owner: &signer) {
        let owner_addr = signer::address_of(owner);
        
        assert!(!exists<SponsorshipRegistry>(owner_addr), E_ALREADY_INITIALIZED);
        
        move_to(owner, SponsorshipRegistry {
            agents: table::new(),
            sponsors: table::new(),
            escrow: coin::zero<AptosCoin>(),
            owner: owner_addr,
        });
    }

    // ============ Sponsor Functions ============

    /// Deposit funds to sponsor an agent
    public entry fun deposit_for_agent(
        sponsor: &signer,
        registry_owner: address,
        agent: address,
        amount: u64,
    ) acquires SponsorshipRegistry {
        let sponsor_addr = signer::address_of(sponsor);
        
        assert!(exists<SponsorshipRegistry>(registry_owner), E_NOT_INITIALIZED);
        
        let registry = borrow_global_mut<SponsorshipRegistry>(registry_owner);
        
        // Transfer funds to escrow
        let deposit = coin::withdraw<AptosCoin>(sponsor, amount);
        coin::merge(&mut registry.escrow, deposit);
        
        // Update or create agent account
        if (!table::contains(&registry.agents, agent)) {
            table::add(&mut registry.agents, agent, AgentSponsorAccount {
                balance: 0,
                total_deposited: 0,
                total_withdrawn: 0,
                sponsor_count: 0,
            });
        };
        
        let agent_account = table::borrow_mut(&mut registry.agents, agent);
        agent_account.balance = agent_account.balance + amount;
        agent_account.total_deposited = agent_account.total_deposited + amount;
        
        // Track sponsor contribution
        if (!table::contains(&registry.sponsors, sponsor_addr)) {
            table::add(&mut registry.sponsors, sponsor_addr, table::new());
        };
        
        let sponsor_table = table::borrow_mut(&mut registry.sponsors, sponsor_addr);
        if (!table::contains(sponsor_table, agent)) {
            table::add(sponsor_table, agent, SponsorContribution {
                amount: 0,
                timestamp: 0,
            });
            agent_account.sponsor_count = agent_account.sponsor_count + 1;
        };
        
        let contribution = table::borrow_mut(sponsor_table, agent);
        contribution.amount = contribution.amount + amount;
        contribution.timestamp = aptos_framework::timestamp::now_seconds();
        
        let new_balance = agent_account.balance;
        
        event::emit(SponsorDepositEvent {
            sponsor: sponsor_addr,
            agent,
            amount,
            new_balance,
            timestamp: contribution.timestamp,
        });
    }

    /// Agent withdraws sponsored funds
    public entry fun agent_withdraw(
        agent: &signer,
        registry_owner: address,
        amount: u64,
    ) acquires SponsorshipRegistry {
        let agent_addr = signer::address_of(agent);
        
        let registry = borrow_global_mut<SponsorshipRegistry>(registry_owner);
        
        assert!(table::contains(&registry.agents, agent_addr), E_AGENT_NOT_FOUND);
        
        let agent_account = table::borrow_mut(&mut registry.agents, agent_addr);
        assert!(agent_account.balance >= amount, E_INSUFFICIENT_BALANCE);
        
        // Transfer from escrow to agent
        let withdrawal = coin::extract(&mut registry.escrow, amount);
        coin::deposit(agent_addr, withdrawal);
        
        agent_account.balance = agent_account.balance - amount;
        agent_account.total_withdrawn = agent_account.total_withdrawn + amount;
        
        event::emit(AgentWithdrawalEvent {
            agent: agent_addr,
            amount,
            remaining_balance: agent_account.balance,
            timestamp: aptos_framework::timestamp::now_seconds(),
        });
    }

    /// Owner can transfer from agent sponsorship to game escrow
    public entry fun transfer_to_game(
        owner: &signer,
        agent: address,
        amount: u64,
        recipient: address,
    ) acquires SponsorshipRegistry {
        let owner_addr = signer::address_of(owner);
        
        let registry = borrow_global_mut<SponsorshipRegistry>(owner_addr);
        assert!(registry.owner == owner_addr, E_NOT_AUTHORIZED);
        
        assert!(table::contains(&registry.agents, agent), E_AGENT_NOT_FOUND);
        
        let agent_account = table::borrow_mut(&mut registry.agents, agent);
        assert!(agent_account.balance >= amount, E_INSUFFICIENT_BALANCE);
        
        // Transfer from escrow to recipient (game contract)
        let transfer = coin::extract(&mut registry.escrow, amount);
        coin::deposit(recipient, transfer);
        
        agent_account.balance = agent_account.balance - amount;
        agent_account.total_withdrawn = agent_account.total_withdrawn + amount;
    }

    // ============ View Functions ============

    #[view]
    public fun get_agent_balance(registry_owner: address, agent: address): u64 acquires SponsorshipRegistry {
        let registry = borrow_global<SponsorshipRegistry>(registry_owner);
        if (!table::contains(&registry.agents, agent)) {
            return 0
        };
        table::borrow(&registry.agents, agent).balance
    }

    #[view]
    public fun get_agent_total_deposited(registry_owner: address, agent: address): u64 acquires SponsorshipRegistry {
        let registry = borrow_global<SponsorshipRegistry>(registry_owner);
        if (!table::contains(&registry.agents, agent)) {
            return 0
        };
        table::borrow(&registry.agents, agent).total_deposited
    }

    #[view]
    public fun get_agent_sponsor_count(registry_owner: address, agent: address): u64 acquires SponsorshipRegistry {
        let registry = borrow_global<SponsorshipRegistry>(registry_owner);
        if (!table::contains(&registry.agents, agent)) {
            return 0
        };
        table::borrow(&registry.agents, agent).sponsor_count
    }
}

