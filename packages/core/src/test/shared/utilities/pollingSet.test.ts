/*!
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import assert from 'assert'
import * as sinon from 'sinon'
import { PollingSet } from '../../../shared/utilities/pollingSet'
import * as FakeTimers from '@sinonjs/fake-timers'
import { installFakeClock } from '../../testUtil'

describe('pollingSet', function () {
    let pollingSet: PollingSet<string>
    let clock: FakeTimers.InstalledClock
    before(function () {
        clock = installFakeClock()
    })

    after(function () {})

    beforeEach(function () {})

    afterEach(function () {
        if (pollingSet) {
            pollingSet.clear()
            pollingSet.clearTimer()
        }
    })

    after(function () {
        sinon.restore()
        clock.uninstall()
    })

    it('inherits basic set properties', function () {
        let pollingSet = new PollingSet(0, () => {})
        let item1 = { id: 1 }
        let item2 = { id: 2 }

        pollingSet.add(item1)
        assert.strictEqual(pollingSet.size, 1)
        assert(pollingSet.has(item1))
        assert.strictEqual(pollingSet.has(item2), false)

        pollingSet.delete(item1)
        assert.strictEqual(pollingSet.size, 0)
        assert.strictEqual(pollingSet.has(item1), false)
    })

    it('does not poll on initialization', async function () {
        let pollingSet = new PollingSet(0, () => {})
        assert.strictEqual(pollingSet.isActive(), false)
    })

    it('does not trigger prematurely', async function () {
        let action = sinon.spy()
        pollingSet = new PollingSet(10, action)
        sinon.assert.notCalled(action)
        pollingSet.start('item')

        await clock.tickAsync(9)
        sinon.assert.notCalled(action)
        await clock.tickAsync(1)
        sinon.assert.calledOnce(action)
    })

    it('stops timer once polling set is empty', async function () {
        let pollingSet = new PollingSet(10, () => {})
        pollingSet.start('1')
        pollingSet.add('2')

        let clearStub = sinon.stub(pollingSet, 'clearTimer')
        sinon.assert.notCalled(clearStub)
        assert.strictEqual(pollingSet.isActive(), true)

        pollingSet.delete('1')

        sinon.assert.notCalled(clearStub)
        assert.strictEqual(pollingSet.isActive(), true)

        pollingSet.delete('2')

        await clock.tick(20)

        assert.strictEqual(pollingSet.isActive(), false)
        sinon.assert.callCount(clearStub, 2)
        clearStub.restore()
    })

    it('runs action once per interval', async function () {
        let action = sinon.spy()
        pollingSet = new PollingSet(10, action)
        pollingSet.start('1')
        pollingSet.add('2')

        sinon.assert.callCount(action, 0)
        await clock.tick(11)
        sinon.assert.callCount(action, 1)
        await clock.tick(22)
        sinon.assert.callCount(action, 3)
    })
})
