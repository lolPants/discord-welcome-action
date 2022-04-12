import * as core from '@actions/core'
import { readdir as readDir } from 'fs/promises'
import { join as joinPath } from 'path'
import { inspect } from 'util'
import { AnnotatedError } from './error'
import { isDirectory } from './fs'
import { parseMarkdown } from './parse'
import { type ChannelData } from './send'

const run = async () => {
  // TODO
  // const token = core.getInput('discord-token')
  const contentPath = core.getInput('content')

  const isDir = await isDirectory(contentPath)
  if (!isDir) {
    core.setFailed(`Input 'content' must be a directory`)
    return
  }

  const paths = await readDir(contentPath)
  if (paths.length === 0) {
    core.warning('No template files were found in the specified directory')
    return
  }

  const jobs = paths
    .map(file => joinPath(contentPath, file))
    .map(async path => parseMarkdown(path))

  const files = await Promise.all(jobs)
  const data = files.map(({ path, meta, messages }) => {
    const { senderName, senderImage, channel: channelID } = meta

    if (typeof channelID === 'undefined' || channelID === null) {
      throw new AnnotatedError(
        'Failed to parse template!',
        'Frontmatter key `channel` is missing!',
        { file: path }
      )
    }

    if (typeof channelID !== 'string') {
      throw new AnnotatedError(
        'Failed to parse template!',
        'Frontmatter key `channel` must be a string!',
        { file: path }
      )
    }

    if (typeof senderName !== 'string' && typeof senderName !== 'undefined') {
      throw new AnnotatedError(
        'Failed to parse template!',
        'Frontmatter key `senderName` must be a string!',
        { file: path }
      )
    }

    if (typeof senderImage !== 'string' && typeof senderImage !== 'undefined') {
      throw new AnnotatedError(
        'Failed to parse template!',
        'Frontmatter key `senderImage` must be a string!',
        { file: path }
      )
    }

    const data: ChannelData = {
      channelID,
      messages,
      senderName,
      senderImage,
    }

    return data
  })

  console.log(inspect(data, true, null))
}

void run().catch((error: unknown) => {
  if (error instanceof AnnotatedError) {
    core.error(error.annotation, error.properties)
    core.setFailed(error.message)

    return
  }

  if (typeof error === 'string' || error instanceof Error) core.setFailed(error)
  else core.setFailed('An unknown error occurred!')
})
