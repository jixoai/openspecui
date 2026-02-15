import { beforeAll } from 'vitest'
import { setProjectAnnotations } from 'storybook/preview-api'
import * as rendererAnnotations from '@storybook/web-components/entry-preview'
import * as previewAnnotations from './preview'

const annotations = setProjectAnnotations([rendererAnnotations, previewAnnotations])

beforeAll(annotations.beforeAll)
