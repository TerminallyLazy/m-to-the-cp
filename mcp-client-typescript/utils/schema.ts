import { z } from 'zod';
import type { JSONSchema7, JSONSchema7Definition } from 'json-schema';

/**
 * Creates a zod schema from a JSON Schema object
 * @param schema The JSON Schema definition
 * @returns A zod schema that validates according to the JSON Schema
 */
export function createZodSchema(schema: JSONSchema7 | JSONSchema7Definition): z.ZodTypeAny {
  // Handle schema references
  if (typeof schema === 'boolean') {
    return schema ? z.any() : z.never();
  }

  // Handle references - not fully implemented in this simplified version
  if (schema.$ref) {
    console.warn('Schema references not fully supported:', schema.$ref);
    return z.any();
  }

  // Handle oneOf, anyOf, allOf - simplified implementation
  if (schema.oneOf) {
    // Handle empty arrays or single item arrays
    const schemas = schema.oneOf.map(s => createZodSchema(s));
    return schemas.length === 0 ? z.any() : 
           schemas.length === 1 ? schemas[0] : 
           z.union(schemas as [z.ZodTypeAny, z.ZodTypeAny, ...z.ZodTypeAny[]]);
  }
  
  if (schema.anyOf) {
    // Handle empty arrays or single item arrays
    const schemas = schema.anyOf.map(s => createZodSchema(s));
    return schemas.length === 0 ? z.any() : 
           schemas.length === 1 ? schemas[0] : 
           z.union(schemas as [z.ZodTypeAny, z.ZodTypeAny, ...z.ZodTypeAny[]]);
  }
  
  if (schema.allOf) {
    return schema.allOf.reduce<z.ZodTypeAny>(
      (acc, s) => z.intersection(acc, createZodSchema(s)),
      z.any()
    );
  }

  // Handle different types
  if (schema.type === 'string') {
    let zodSchema = z.string();
    
    if (schema.minLength !== undefined) {
      zodSchema = zodSchema.min(schema.minLength);
    }
    
    if (schema.maxLength !== undefined) {
      zodSchema = zodSchema.max(schema.maxLength);
    }
    
    if (schema.pattern) {
      zodSchema = zodSchema.regex(new RegExp(schema.pattern));
    }
    
    if (schema.format === 'email') {
      zodSchema = zodSchema.email();
    }
    
    if (schema.format === 'uri') {
      zodSchema = zodSchema.url();
    }
    
    if (schema.enum) {
      return z.enum(schema.enum as [string, ...string[]]);
    }
    
    return zodSchema;
  }
  
  if (schema.type === 'number' || schema.type === 'integer') {
    let zodSchema = schema.type === 'integer' ? z.number().int() : z.number();
    
    if (schema.minimum !== undefined) {
      zodSchema = zodSchema.min(schema.minimum);
    }
    
    if (schema.maximum !== undefined) {
      zodSchema = zodSchema.max(schema.maximum);
    }
    
    if (schema.enum) {
      return z.enum(schema.enum as [string, ...string[]]);
    }
    
    return zodSchema;
  }
  
  if (schema.type === 'boolean') {
    return z.boolean();
  }
  
  if (schema.type === 'null') {
    return z.null();
  }
  
  if (schema.type === 'array') {
    let itemSchema: z.ZodTypeAny;
    
    if (schema.items) {
      if (Array.isArray(schema.items)) {
        // Tuple validation not fully implemented in this simplified version
        itemSchema = z.any();
        console.warn('Array items as tuple not fully supported');
      } else {
        itemSchema = createZodSchema(schema.items);
      }
    } else {
      itemSchema = z.any();
    }
    
    let zodSchema = z.array(itemSchema);
    
    if (schema.minItems !== undefined) {
      zodSchema = zodSchema.min(schema.minItems);
    }
    
    if (schema.maxItems !== undefined) {
      zodSchema = zodSchema.max(schema.maxItems);
    }
    
    return zodSchema;
  }
  
  if (schema.type === 'object' || (!schema.type && schema.properties)) {
    const shape: Record<string, z.ZodTypeAny> = {};
    
    if (schema.properties) {
      Object.entries(schema.properties).forEach(([key, propSchema]) => {
        shape[key] = createZodSchema(propSchema);
      });
    }
    
    let zodSchema = z.object(shape);
    
    // Handle required properties
    if (schema.required && schema.required.length > 0) {
      // Make required properties non-optional
      const partialShape = { ...shape };
      
      schema.required.forEach(key => {
        if (partialShape[key]) {
          // Replace with a non-optional version
          partialShape[key] = partialShape[key];
        }
      });
      
      zodSchema = z.object(partialShape);
    }
    
    return zodSchema;
  }
  
  // Default to any for unsupported or undefined types
  return z.any();
} 