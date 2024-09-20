/*!
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import * as vscode from 'vscode'
import { ToolkitError } from '../errors'
import path from 'path'
import { AWSTreeNodeBase } from '../treeview/nodes/awsTreeNodeBase'
import { TreeNode, isTreeNode } from '../treeview/resourceTreeDataProvider'
import * as CloudFormation from '../cloudformation/cloudformation'
import fs from '../fs/fs'

/**
 * @description Finds the samconfig.toml file under the provided project folder
 * @param projectRoot The root folder of the application project
 * @returns The URI of the samconfig.toml file
 */
export async function getConfigFileUri(projectRoot: vscode.Uri): Promise<vscode.Uri> {
    const samConfigFilename = 'samconfig.toml'
    const samConfigPath = path.join(projectRoot.path, samConfigFilename)
    if (await fs.exists(samConfigPath)) {
        return vscode.Uri.file(samConfigPath)
    } else {
        throw new ToolkitError(`No samconfig.toml file found in ${projectRoot.fsPath}`, { code: 'samNoConfigFound' })
    }
}

/**
 * @description Finds the template.yaml file under the provided project folder
 * @param projectRoot The root folder of the application project
 * @returns The URI of the template.yaml file
 */
export async function getTemplateFileUri(projectRoot: vscode.Uri) {
    const templateNames = ['template.yaml', 'template.yml']
    for (const templateName of templateNames) {
        const templatePath = path.join(projectRoot.path, templateName)
        if (await fs.exists(templatePath)) {
            return vscode.Uri.file(templatePath)
        }
    }

    throw new ToolkitError(`No template.ysml or template.yml found in ${projectRoot.fsPath}`, {
        code: 'samNoTemplateFound',
    })
}

/**
 * @description determines the root directory of the project given uri of the template file
 * @param template The template.yaml uri
 * @returns The URI of the root project folder (may differ from workspace)
 * */
export const getProjectRootUri = (templateUri: vscode.Uri) => vscode.Uri.file(path.dirname(templateUri.path))

/**
 * @description Retrieves the root folders of all SAM template files (template.yaml or template.yml)
 *              in the current workspace.
 * @returns A Promise that resolves to an array of vscode.Uri objects, each representing a project root folder.
 *          If no workspace folders are open, it returns an empty array.
 * @remarks
 * - The function excludes searching in 'node_modules' and '.aws-sam' directories.
 * - It considers the parent directory of each template file as a project root.
 */
export async function getProjectRootFoldersInWorkspace(): Promise<vscode.Uri[]> {
    if (!vscode.workspace.workspaceFolders) {
        return []
    }
    const templateFiles = await vscode.workspace.findFiles('**/template.{yaml,yml}', '**/{node_modules,.aws-sam}/**')
    const projectRootFolders = []

    for (const templateFile of templateFiles) {
        const rootFolder = vscode.Uri.parse(path.dirname(templateFile.fsPath))
        projectRootFolders.push(rootFolder)
    }

    return projectRootFolders
}

export function getSource(arg: vscode.Uri | AWSTreeNodeBase | TreeNode | undefined): string | undefined {
    if (arg instanceof vscode.Uri) {
        return 'template'
    } else if (arg instanceof AWSTreeNodeBase) {
        return 'regionNode'
    } else if (isTreeNode(arg)) {
        return 'appBuilderDeploy'
    } else {
        return undefined
    }
}

export async function isDotnetRuntime(templateUri: vscode.Uri): Promise<boolean> {
    const samTemplate = await CloudFormation.tryLoad(templateUri)

    if (!samTemplate.template?.Resources) {
        return false
    }
    for (const resource of Object.values(samTemplate.template.Resources)) {
        if (resource?.Type === 'AWS::Serverless::Function') {
            if (resource.Properties?.Runtime && resource.Properties?.Runtime.startsWith('dotnet')) {
                return true
            }
        }
    }
    const globalRuntime = samTemplate.template.Globals?.Function?.Runtime as string
    return globalRuntime ? globalRuntime.startsWith('dotnet') : false
}
