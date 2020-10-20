/**
 * @dev Constant flow agreement v1 helper class
 */
module.exports = class ConstantFlowAgreementV1Helper {

    /**
     * @dev Create new helper class
     * @param {Framework} sf Superfluid Framework object
     *
     * NOTE: You should call async function Framework.initialize to initialize the object.
     */
    constructor(sf) {
        this._sf = sf;
        this._cfa = sf.agreements.cfa;
    }

    /**
     * @dev Create a new flow
     * @param {tokenParam} superToken superToken for the flow
     * @param {addressParam} sender sender of the flow
     * @param {addressParam} receiver receiver of the flow
     * @param {flowRateParam} flowRate the flowrate of the flow
     * @return {Promise<Transaction>} web3 transaction object
     */
    async createFlow({
        superToken,
        sender,
        receiver,
        flowRate
    }) {
        const superTokenNorm = await this._sf.utils.normalizeTokenParam(superToken);
        const senderNorm = await this._sf.utils.normalizeAddressParam(sender);
        const receiverNorm = await this._sf.utils.normalizeAddressParam(receiver);
        const flowRateNorm = this._sf.utils.normalizeFlowRateParam(flowRate);
        console.debug(`Create flow from ${sender} to ${receiver} at ${flowRate} ...`);
        const tx = await this._sf.host.callAgreement(
            this._cfa.address,
            this._cfa.contract.methods.createFlow(
                superTokenNorm,
                receiverNorm,
                flowRateNorm,
                "0x"
            ).encodeABI(),
            {
                from: senderNorm,
            }
        );
        console.debug("Flow created.");
        return tx;
    }

    /**
     * @dev Update a new flow with a new flow rate
     * @param {tokenParam} superToken superToken for the flow
     * @param {addressParam} sender sender of the flow
     * @param {addressParam} receiver receiver of the flow
     * @param {flowRateParam} flowRate the flowrate of the flow
     * @return {Promise<Transaction>} web3 transaction object
     */
    async updateFlow({
        superToken,
        sender,
        receiver,
        flowRate
    }) {
        const superTokenNorm = await this._sf.utils.normalizeTokenParam(superToken);
        const senderNorm = await this._sf.utils.normalizeAddressParam(sender);
        const receiverNorm = await this._sf.utils.normalizeAddressParam(receiver);
        const flowRateNorm = this._sf.utils.normalizeFlowRateParam(flowRate);
        console.debug(`Update flow from ${sender} to ${receiver} to ${flowRate} ...`);
        const tx = await this._sf.host.callAgreement(
            this._cfa.address,
            this._cfa.contract.methods.updateFlow(
                superTokenNorm,
                receiverNorm,
                flowRateNorm,
                "0x"
            ).encodeABI(),
            {
                from: senderNorm,
            }
        );
        console.debug("Flow updated.");
        return tx;
    }

    /**
     * @dev Delete a existing flow
     * @param {tokenParam} superToken superToken for the flow
     * @param {addressParam} sender sender of the flow
     * @param {addressParam} receiver receiver of the flow
     * @param {addressParam} by delete flow by a third party (liquidations)
     * @return {Promise<Transaction>} web3 transaction object
     */
    async deleteFlow({
        superToken,
        sender,
        receiver,
        by
    }) {
        const superTokenNorm = await this._sf.utils.normalizeTokenParam(superToken);
        const senderNorm = await this._sf.utils.normalizeAddressParam(sender);
        const receiverNorm = await this._sf.utils.normalizeAddressParam(receiver);
        const byNorm = (by && await this._sf.utils.normalizeAddressParam(by)) || senderNorm;
        console.debug(`Delete flow from ${sender} to ${receiver} ...`);
        const tx = await this._sf.host.callAgreement(
            this._cfa.address,
            this._cfa.contract.methods.deleteFlow(
                superTokenNorm,
                senderNorm,
                receiverNorm,
                "0x"
            ).encodeABI(),
            {
                from: byNorm,
            }
        );
        console.debug("Flow updated.");
        return tx;
    }

    /**
     * @dev Get information of a existing flow
     * @param {tokenParam} superToken superToken for the flow
     * @param {addressParam} sender sender of the flow
     * @param {addressParam} receiver receiver of the flow
     * @return {Promise<object>} Informationo about the flow:
     *         - <Date> timestamp, time when the flow was last updated
     *         - <string> flowRate, flow rate of the flow
     *         - <string> deposit, deposit of the flow
     *         - <string> owedDeposit, owed deposit of the flow
     */
    async getFlow({
        superToken,
        sender,
        receiver
        //unit
    }) {
        const superTokenNorm = await this._sf.utils.normalizeTokenParam(superToken);
        const senderNorm = await this._sf.utils.normalizeAddressParam(sender);
        const receiverNorm = await this._sf.utils.normalizeAddressParam(receiver);
        const result = await this._cfa.getFlow(superTokenNorm, senderNorm, receiverNorm);
        // sanitize result
        return (({
            timestamp,
            flowRate,
            deposit,
            owedDeposit
        }) => {
            return {
                timestamp: new Date(Number(timestamp.toString())*1000),
                flowRate: flowRate.toString(),
                deposit: deposit.toString(),
                owedDeposit: owedDeposit.toString(),
            };
        })(result);
    }

    /**
     * @dev Get information of the net flow of an account
     * @param {tokenParam} superToken superToken for the flow
     * @param {addressParam} account the account for the query
     * @return {Promise<string>} Net flow rate of the account
     */
    async getNetFlow({
        superToken,
        account,
        //unit
    }) {
        const superTokenNorm = await this._sf.utils.normalizeTokenParam(superToken);
        const accountNorm = await this._sf.utils.normalizeAddressParam(account);
        return await this._cfa.getNetFlow(superTokenNorm, accountNorm);
    }

    static getLatestFlows(flows) {
        return Object.values(flows.reduce((acc, i) => {
            acc[i.args.sender + ":" + i.args.receiver] = i;
            return acc;
        }, {})).filter(i => i.args.flowRate.toString() != "0");
    }

    /**
     * @dev List flows of the account
     * @param {tokenParam} superToken superToken for the flow
     * @param {addressParam} account the account for the query
     * @return {Promise<[]>}
     */
    async listFlows({
        superToken,
        account,
        onlyInFlows,
        onlyOutFlows,
        //unit
    }) {
        const superTokenNorm = await this._sf.utils.normalizeTokenParam(superToken);
        const accountNorm = await this._sf.utils.normalizeAddressParam(account);
        const result = { };
        if (!onlyOutFlows) {
            result.inFlows = this.constructor.getLatestFlows(
                await this._sf.agreements.cfa.getPastEvents("FlowUpdated", {
                    fromBlock: 0,
                    toBlock: "latest",
                    filter: {
                        token: superTokenNorm,
                        receiver: accountNorm
                    }
                })).map(f => ({
                sender: f.args.sender,
                receiver: f.args.receiver,
                flowRate: f.args.flowRate.toString(),
            }));
        }
        if (!onlyInFlows) {
            result.outFlows = this.constructor.getLatestFlows(
                await this._sf.agreements.cfa.getPastEvents("FlowUpdated", {
                    fromBlock: 0,
                    toBlock: "latest",
                    filter: {
                        token: superTokenNorm,
                        sender: accountNorm
                    }
                })).map(f => ({
                sender: f.args.sender,
                receiver: f.args.receiver,
                flowRate: f.args.flowRate.toString(),
            }));
        }
        return result;
    }

};