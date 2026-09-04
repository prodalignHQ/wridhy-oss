import * as React from 'react'
import { Select } from '@base-ui/react/select'

export function Test() {
  return React.createElement(Select.Item, { value: '1', label: 'One' }, "One")
}
