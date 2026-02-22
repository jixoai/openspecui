import * as rendererAnnotations from '@storybook/web-components/entry-preview'
import { setProjectAnnotations } from 'storybook/preview-api'
import { beforeAll } from 'vitest'
import * as previewAnnotations from './preview'

const annotations = setProjectAnnotations([rendererAnnotations, previewAnnotations])

beforeAll(annotations.beforeAll)
