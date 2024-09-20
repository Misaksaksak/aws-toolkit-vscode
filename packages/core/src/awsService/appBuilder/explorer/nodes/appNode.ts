/*!
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import * as nls from 'vscode-nls'
const localize = nls.loadMessageBundle()

import * as vscode from 'vscode'
import { getLogger } from '../../../../shared/logger'
import { ResourceTreeEntity, SamAppLocation, getApp, getStackName } from '../samProject'
import { ResourceNode, generateResourceNodes } from './resourceNode'
import { generateStackNode } from './deployedStack'
import { TreeNode } from '../../../../shared/treeview/resourceTreeDataProvider'
import { createPlaceholderItem } from '../../../../shared/treeview/utils'
import { getIcon } from '../../../../shared/icons'
import { getSamCliContext } from '../../../../shared/sam/cli/samCliContext'
import { SamCliListResourcesParameters } from '../../../../shared/sam/cli/samCliListResources'
import { getDeployedResources, StackResource } from '../../../../lambda/commands/listSamResources'
import * as path from 'path'
import fs from '../../../../shared/fs/fs'

export class AppNode implements TreeNode {
    public readonly id = this.location.samTemplateUri.toString()
    public readonly resource = this.location
    public readonly label = path.join(
        this.location.workspaceFolder.name,
        path.relative(this.location.workspaceFolder.uri.fsPath, path.dirname(this.location.samTemplateUri.fsPath))
    )
    private stackName: string = ''
    public constructor(private readonly location: SamAppLocation) {}

    public async getChildren(): Promise<(ResourceNode | TreeNode)[]> {
        const resources = []
        try {
            const successfulApp = await getApp(this.location)
            const templateResources: ResourceTreeEntity[] = successfulApp.resourceTree
            const { stackName, region } = await getStackName(this.location.projectRoot)
            this.stackName = stackName

            const listStackResourcesArguments: SamCliListResourcesParameters = {
                stackName: this.stackName,
                templateFile: this.location.samTemplateUri.fsPath,
                region: region,
                projectRoot: this.location.projectRoot,
            }

            const deployedResources: StackResource[] | undefined = this.stackName
                ? await getDeployedResources({
                      listResourcesParams: listStackResourcesArguments,
                      invoker: getSamCliContext().invoker,
                  })
                : undefined
            resources.push(...generateStackNode(this.location, this.stackName, region))
            resources.push(
                ...generateResourceNodes(this.location, templateResources, this.stackName, region, deployedResources)
            )

            // indicate that App exists, but it is empty
            if (resources.length === 0) {
                if (await fs.exists(this.location.samTemplateUri)) {
                    return [
                        createPlaceholderItem(
                            localize(
                                'AWS.appBuilder.explorerNode.app.noResource',
                                '[No resource found in IaC template]'
                            )
                        ),
                    ]
                }
                return [
                    createPlaceholderItem(
                        localize('AWS.appBuilder.explorerNode.app.noTemplate', '[No IaC templates found in Workspaces]')
                    ),
                ]
            }
            return resources
        } catch (error) {
            getLogger().error(`Could not load the construct tree located at '${this.id}': %O`, error as Error)
            return [
                createPlaceholderItem(
                    localize(
                        'AWS.appBuilder.explorerNode.app.noResourceTree',
                        '[Unable to load Resource tree for this App. Update IaC template]'
                    )
                ),
            ]
        }
    }

    public getTreeItem() {
        const item = new vscode.TreeItem(this.label, vscode.TreeItemCollapsibleState.Collapsed)

        item.contextValue = 'awsAppBuilderAppNode'
        item.iconPath = getIcon('vscode-folder')
        item.resourceUri = this.location.samTemplateUri
        item.tooltip = this.location.samTemplateUri.path

        return item
    }
}
