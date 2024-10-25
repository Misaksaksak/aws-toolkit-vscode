/*!
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */
import * as vscode from 'vscode'
import * as sinon from 'sinon'
import { assertTelemetry } from '../../testUtil'
import { Ec2InstanceNode } from '../../../awsService/ec2/explorer/ec2InstanceNode'
import { Ec2ParentNode } from '../../../awsService/ec2/explorer/ec2ParentNode'
import { Ec2Client } from '../../../shared/clients/ec2Client'
import { Ec2ConnectionManager } from '../../../awsService/ec2/model'
import { PollingSet } from '../../../shared/utilities/pollingSet'

describe('ec2 telemetry', function () {
    let testNode: Ec2InstanceNode

    before(function () {
        const testRegion = 'test-region'
        const testPartition = 'test-partition'
        // Don't want to be polling here, that is tested in ../ec2ParentNode.test.ts
        // disabled here for convenience (avoiding race conditions with timeout)
        sinon.stub(PollingSet.prototype, 'start')
        const testClient = new Ec2Client(testRegion)
        const parentNode = new Ec2ParentNode(testRegion, testPartition, new Ec2Client(testRegion))
        testNode = new Ec2InstanceNode(parentNode, testClient, testRegion, testPartition, {
            InstanceId: 'testId',
            LastSeenStatus: 'status',
        })
    })
    it('emits correct telemetry on terminal open', async function () {
        const terminalStub = sinon.stub(Ec2ConnectionManager.prototype, 'attemptToOpenEc2Terminal')
        await vscode.commands.executeCommand('aws.ec2.openTerminal', testNode)

        assertTelemetry('ec2_connectToInstance', { ec2ConnectionType: 'ssm' })
        terminalStub.restore()
    })

    it('emits correct telemetry on remote window open', async function () {
        const remoteWindowStub = sinon.stub(Ec2ConnectionManager.prototype, 'tryOpenRemoteConnection')
        await vscode.commands.executeCommand('aws.ec2.openRemoteConnection', testNode)

        assertTelemetry('ec2_connectToInstance', { ec2ConnectionType: 'remoteWorkspace' })
        remoteWindowStub.restore()
    })

    it('emits correct telemetry on state stop', async function () {
        const stopInstanceStub = sinon.stub(Ec2Client.prototype, 'stopInstanceWithCancel')
        await vscode.commands.executeCommand('aws.ec2.stopInstance', testNode)

        assertTelemetry('ec2_changeState', { ec2InstanceState: 'stop' })
        stopInstanceStub.restore()
    })

    it('emits correct telemetry on state start', async function () {
        const startInstanceStub = sinon.stub(Ec2Client.prototype, 'startInstance')
        await vscode.commands.executeCommand('aws.ec2.startInstance', testNode)

        assertTelemetry('ec2_changeState', { ec2InstanceState: 'start' })
        startInstanceStub.restore()
    })

    it('emits correct telemetry on state reboot', async function () {
        const rebootInstanceStub = sinon.stub(Ec2Client.prototype, 'rebootInstance')
        await vscode.commands.executeCommand('aws.ec2.rebootInstance', testNode)

        assertTelemetry('ec2_changeState', { ec2InstanceState: 'reboot' })
        rebootInstanceStub.restore()
    })
})
