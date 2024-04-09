
export function addressToShort(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`
}

export function toUpperFirst(s: string) {
  if (!s || s.length === 0) return s
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase()
}

export type ParsedFunctionSelector = { name: string, inputs: { name?: string, type: string }[] }

export function parsedToAbi(parsed: ParsedFunctionSelector) {
  return [{
    constant: false,
    outputs: [],
    name: parsed.name,
    inputs: parsed.inputs.map((input, index) => {
      return {
        name: input.name || index + 'Arg',
        type: input.type
      }
    }),
    payable: false,
    stateMutability: 'nonpayable',
    type: 'function',
  }]
}

export function parseFunctionSelector(selector: string): ParsedFunctionSelector {
  const [name, inputs] = selector.split('(')
  if (!inputs) {
    throw new Error('Missing input arguments')
  }
  
  const inputTypes = inputs.slice(0, -1).split(',').filter((input) => input.trim() !== '')

  const res = {
    name,
    inputs: inputTypes.map((input) => {
      // Name is optional
      const parts = input.split(' ')
      if (parts.length === 1) {
        return { type: parts[0] }
      }
      
      const trimmed0 = parts[0].trim()
      const trimmed1 = parts[1].trim()

      if (trimmed0 === '') {
        return { type: trimmed1 }
      }

      if (trimmed1 === '') {
        return { type: trimmed0 }
      }

      return {
        name: trimmed0,
        type: trimmed1
      }
    })
  }

  if (res.name === '') {
    throw new Error('Empty function name')
  }

  for (const input of res.inputs) {
    if (!/^(address|uint\d+|int\d+|bool|bytes\d*|string)$/.test(input.type)) {
      throw new Error('Invalid type: ' + input.type)
    }
  }

  return res
}