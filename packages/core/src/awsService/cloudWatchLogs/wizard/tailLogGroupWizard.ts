/*!
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import * as nls from 'vscode-nls'
import { ToolkitError } from '../../../shared'
import { DefaultCloudWatchLogsClient } from '../../../shared/clients/cloudWatchLogsClient'
import { cwlFilterPatternHelpUrl } from '../../../shared/constants'
import { createBackButton, createExitButton, createHelpButton } from '../../../shared/ui/buttons'
import { RegionSubmenu, RegionSubmenuResponse } from '../../../shared/ui/common/regionSubmenu'
import { createInputBox } from '../../../shared/ui/inputPrompter'
import { DataQuickPickItem } from '../../../shared/ui/pickerPrompter'
import { Wizard } from '../../../shared/wizards/wizard'
import { CloudWatchLogsGroupInfo } from '../registry/logDataRegistry'
import { LogStreamFilterResponse, LogStreamFilterSubmenu } from './liveTailLogStreamSubmenu'

const localize = nls.loadMessageBundle()

export interface TailLogGroupWizardResponse {
    regionLogGroupSubmenuResponse: RegionSubmenuResponse<string>
    logStreamFilter: LogStreamFilterResponse
    filterPattern: string
}

export class TailLogGroupWizard extends Wizard<TailLogGroupWizardResponse> {
    public constructor(logGroupInfo?: CloudWatchLogsGroupInfo) {
        super({
            initState: {
                regionLogGroupSubmenuResponse: logGroupInfo
                    ? {
                          data: logGroupInfo.groupName,
                          region: logGroupInfo.regionName,
                      }
                    : undefined,
            },
        })
        this.form.regionLogGroupSubmenuResponse.bindPrompter(createRegionLogGroupSubmenu)
        this.form.logStreamFilter.bindPrompter((state) => {
            if (!state.regionLogGroupSubmenuResponse?.data) {
                throw new ToolkitError('LogGroupName is null')
            }
            return new LogStreamFilterSubmenu(
                state.regionLogGroupSubmenuResponse.data,
                state.regionLogGroupSubmenuResponse.region
            )
        })
        this.form.filterPattern.bindPrompter((state) => createFilterPatternPrompter())
    }
}

export function createRegionLogGroupSubmenu(): RegionSubmenu<string> {
    return new RegionSubmenu(
        getLogGroupQuickPickOptions,
        {
            title: localize('AWS.cwl.tailLogGroup.logGroupPromptTitle', 'Select Log Group to tail'),
            buttons: [createExitButton()],
        },
        { title: localize('AWS.cwl.tailLogGroup.regionPromptTitle', 'Select Region for Log Group') },
        'LogGroups'
    )
}

async function getLogGroupQuickPickOptions(regionCode: string): Promise<DataQuickPickItem<string>[]> {
    const client = new DefaultCloudWatchLogsClient(regionCode)
    const logGroups = client.describeLogGroups()

    const logGroupsOptions: DataQuickPickItem<string>[] = []

    for await (const logGroupObject of logGroups) {
        if (!logGroupObject.arn || !logGroupObject.logGroupName) {
            throw new ToolkitError('LogGroupObject name or arn undefined')
        }

        logGroupsOptions.push({
            label: logGroupObject.logGroupName,
            data: formatLogGroupArn(logGroupObject.arn),
        })
    }

    return logGroupsOptions
}

function formatLogGroupArn(logGroupArn: string): string {
    return logGroupArn.endsWith(':*') ? logGroupArn.substring(0, logGroupArn.length - 2) : logGroupArn
}

export function createFilterPatternPrompter() {
    const helpUri = cwlFilterPatternHelpUrl
    return createInputBox({
        title: 'Provide log event filter pattern',
        placeholder: 'filter pattern (case sensitive; empty matches all)',
        prompt: 'Optional pattern to use to filter the results to include only log events that match the pattern.',
        buttons: [createHelpButton(helpUri), createBackButton(), createExitButton()],
    })
}