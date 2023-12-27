import {
    AccountUpdate,
    Bool,
    Circuit,
    DeployArgs,
    Experimental,
    Field,
    Int64,
    Permissions,
    Provable,
    PublicKey,
    SmartContract,
    State,
    UInt64,
    method,
    state,
} from 'o1js'

export class Token extends SmartContract {
    @state(UInt64) decimals = State<UInt64>()
    @state(UInt64) maxSupply = State<UInt64>()
    @state(UInt64) circulatingSupply = State<UInt64>()
    @state(PublicKey) owner = State<PublicKey>()

    deploy(args?: DeployArgs) {
        super.deploy(args)
        this.account.tokenSymbol.set("WBTC");
        this.account.permissions.set({
            ...Permissions.default(),
            access: Permissions.proofOrSignature(),
        })
    }

    @method initialize(decimals: UInt64, maxSupply: UInt64) {
        this.decimals.set(decimals)
        this.maxSupply.set(maxSupply)
        this.owner.set(this.sender)
    }

    @method mint(receiver: PublicKey, amount: UInt64) {
        Provable.log(this.sender, "===", this.owner.get())
        this.owner.getAndRequireEquals().assertEquals(this.sender)
        const maxSupply = this.maxSupply.getAndRequireEquals()
        const circulatingSupply = this.circulatingSupply.getAndRequireEquals()

        const newCirculatingSupply = circulatingSupply.add(amount)

        newCirculatingSupply.assertLessThanOrEqual(maxSupply)

        this.token.mint({
            address: receiver,
            amount,
        })

        this.circulatingSupply.set(newCirculatingSupply)
    }

    @method burn(burner: PublicKey, amount: UInt64) {
        const circulatingSupply = this.circulatingSupply.getAndRequireEquals()

        const newCirculatingSupply = circulatingSupply.sub(amount)

        this.token.burn({
            address: burner,
            amount,
        })

        this.circulatingSupply.set(newCirculatingSupply)
    }

    @method transfer(sender: PublicKey, receiver: PublicKey, amount: UInt64) {
        this.token.send({ from: sender, to: receiver, amount })
    }

    @method approveUpdate(zkappUpdate: AccountUpdate) {
        this.approve(zkappUpdate)
        const balanceChange = Int64.fromObject(zkappUpdate.body.balanceChange)
        balanceChange.assertEquals(Int64.from(0))
    }

    /**
   * 'sendTokens()' sends tokens from `senderAddress` to `receiverAddress`.
   *
   * It does so by deducting the amount of tokens from `senderAddress` by
   * authorizing the deduction with a proof. It then creates the receiver
   * from `receiverAddress` and sends the amount.
   */
  @method sendTokensFromZkApp(
    receiverAddress: PublicKey,
    amount: UInt64,
    callback: Experimental.Callback<any>
  ) {
    // approves the callback which deductes the amount of tokens from the sender
    let senderAccountUpdate = this.approve(callback);

    Provable.log(`Token Id:`, this.token.id.toString());
    Provable.log(`Balance Change:`, senderAccountUpdate.body.tokenId, senderAccountUpdate.body.balanceChange)
    // Create constraints for the sender account update and amount
    let negativeAmount = Int64.fromObject(
      senderAccountUpdate.body.balanceChange
    );
    negativeAmount.assertEquals(Int64.from(amount).neg());
    let tokenId = this.token.id;

    // Create receiver accountUpdate
    let receiverAccountUpdate = Experimental.createChildAccountUpdate(
      this.self,
      receiverAddress,
      tokenId
    );
    receiverAccountUpdate.balance.addInPlace(amount);
  }
}
