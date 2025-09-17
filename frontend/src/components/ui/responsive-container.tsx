'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { useBreakpoints, useContainerMaxWidth } from '@/hooks/use-responsive';

interface ResponsiveContainerProps extends React.HTMLAttributes<HTMLDivElement> {
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl' | '5xl' | '6xl' | '7xl' | 'full' | 'auto';
  padding?: 'none' | 'sm' | 'md' | 'lg' | 'xl';
  center?: boolean;
  fluid?: boolean;
}

export function ResponsiveContainer({
  children,
  className,
  maxWidth = 'auto',
  padding = 'md',
  center = true,
  fluid = false,
  ...props
}: ResponsiveContainerProps) {
  const autoMaxWidth = useContainerMaxWidth();

  const maxWidthClass = maxWidth === 'auto' ? autoMaxWidth : `max-w-${maxWidth}`;

  const paddingClasses = {
    none: '',
    sm: 'px-4 sm:px-6',
    md: 'px-4 sm:px-6 lg:px-8',
    lg: 'px-6 sm:px-8 lg:px-12',
    xl: 'px-8 sm:px-12 lg:px-16',
  };

  return (
    <div
      className={cn(
        fluid ? 'w-full' : 'container',
        !fluid && maxWidthClass,
        center && 'mx-auto',
        paddingClasses[padding],
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

// Grid component that adapts to screen size
interface ResponsiveGridProps extends React.HTMLAttributes<HTMLDivElement> {
  cols?: {
    default?: number;
    sm?: number;
    md?: number;
    lg?: number;
    xl?: number;
    '2xl'?: number;
  };
  gap?: 'none' | 'sm' | 'md' | 'lg' | 'xl';
  rows?: 'auto' | number;
}

export function ResponsiveGrid({
  children,
  className,
  cols = { default: 1, md: 2, lg: 3 },
  gap = 'md',
  rows = 'auto',
  ...props
}: ResponsiveGridProps) {
  const gapClasses = {
    none: 'gap-0',
    sm: 'gap-2 sm:gap-3',
    md: 'gap-4 sm:gap-6',
    lg: 'gap-6 sm:gap-8',
    xl: 'gap-8 sm:gap-12',
  };

  const getGridColsClass = () => {
    const classes = ['grid'];

    if (cols.default) classes.push(`grid-cols-${cols.default}`);
    if (cols.sm) classes.push(`sm:grid-cols-${cols.sm}`);
    if (cols.md) classes.push(`md:grid-cols-${cols.md}`);
    if (cols.lg) classes.push(`lg:grid-cols-${cols.lg}`);
    if (cols.xl) classes.push(`xl:grid-cols-${cols.xl}`);
    if (cols['2xl']) classes.push(`2xl:grid-cols-${cols['2xl']}`);

    return classes.join(' ');
  };

  const rowsClass = rows === 'auto' ? '' : `grid-rows-${rows}`;

  return (
    <div
      className={cn(
        getGridColsClass(),
        rowsClass,
        gapClasses[gap],
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

// Flex component with responsive direction and spacing
interface ResponsiveFlexProps extends React.HTMLAttributes<HTMLDivElement> {
  direction?: {
    default?: 'row' | 'col' | 'row-reverse' | 'col-reverse';
    sm?: 'row' | 'col' | 'row-reverse' | 'col-reverse';
    md?: 'row' | 'col' | 'row-reverse' | 'col-reverse';
    lg?: 'row' | 'col' | 'row-reverse' | 'col-reverse';
    xl?: 'row' | 'col' | 'row-reverse' | 'col-reverse';
  };
  gap?: 'none' | 'sm' | 'md' | 'lg' | 'xl';
  align?: 'start' | 'center' | 'end' | 'stretch' | 'baseline';
  justify?: 'start' | 'center' | 'end' | 'between' | 'around' | 'evenly';
  wrap?: boolean;
}

export function ResponsiveFlex({
  children,
  className,
  direction = { default: 'row' },
  gap = 'md',
  align = 'start',
  justify = 'start',
  wrap = false,
  ...props
}: ResponsiveFlexProps) {
  const gapClasses = {
    none: 'gap-0',
    sm: 'gap-2 sm:gap-3',
    md: 'gap-4 sm:gap-6',
    lg: 'gap-6 sm:gap-8',
    xl: 'gap-8 sm:gap-12',
  };

  const getFlexDirectionClass = () => {
    const classes = ['flex'];

    if (direction.default) classes.push(`flex-${direction.default}`);
    if (direction.sm) classes.push(`sm:flex-${direction.sm}`);
    if (direction.md) classes.push(`md:flex-${direction.md}`);
    if (direction.lg) classes.push(`lg:flex-${direction.lg}`);
    if (direction.xl) classes.push(`xl:flex-${direction.xl}`);

    return classes.join(' ');
  };

  const alignClass = `items-${align}`;
  const justifyClass = `justify-${justify}`;
  const wrapClass = wrap ? 'flex-wrap' : '';

  return (
    <div
      className={cn(
        getFlexDirectionClass(),
        alignClass,
        justifyClass,
        wrapClass,
        gapClasses[gap],
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

// Show/hide components based on breakpoints
interface ResponsiveShowProps {
  children: React.ReactNode;
  above?: 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  below?: 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  only?: 'sm' | 'md' | 'lg' | 'xl' | '2xl';
}

export function ResponsiveShow({ children, above, below, only }: ResponsiveShowProps) {
  const breakpoints = useBreakpoints();

  const shouldShow = React.useMemo(() => {
    if (only) {
      // Show only at specific breakpoint
      switch (only) {
        case 'sm': return breakpoints.sm && !breakpoints.md;
        case 'md': return breakpoints.md && !breakpoints.lg;
        case 'lg': return breakpoints.lg && !breakpoints.xl;
        case 'xl': return breakpoints.xl && !breakpoints['2xl'];
        case '2xl': return breakpoints['2xl'];
        default: return false;
      }
    }

    if (above) {
      // Show above specific breakpoint
      return breakpoints[above];
    }

    if (below) {
      // Show below specific breakpoint
      return !breakpoints[below];
    }

    return true;
  }, [breakpoints, above, below, only]);

  return shouldShow ? <>{children}</> : null;
}

// Responsive text sizing
interface ResponsiveTextProps extends React.HTMLAttributes<HTMLDivElement> {
  size?: {
    default?: 'xs' | 'sm' | 'base' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl' | '5xl' | '6xl';
    sm?: 'xs' | 'sm' | 'base' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl' | '5xl' | '6xl';
    md?: 'xs' | 'sm' | 'base' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl' | '5xl' | '6xl';
    lg?: 'xs' | 'sm' | 'base' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl' | '5xl' | '6xl';
    xl?: 'xs' | 'sm' | 'base' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl' | '5xl' | '6xl';
  };
  weight?: 'thin' | 'light' | 'normal' | 'medium' | 'semibold' | 'bold' | 'extrabold' | 'black';
  leading?: 'none' | 'tight' | 'snug' | 'normal' | 'relaxed' | 'loose';
  as?: keyof JSX.IntrinsicElements;
}

export function ResponsiveText({
  children,
  className,
  size = { default: 'base' },
  weight = 'normal',
  leading = 'normal',
  as: Component = 'div',
  ...props
}: ResponsiveTextProps) {
  const getTextSizeClass = () => {
    const classes = [];

    if (size.default) classes.push(`text-${size.default}`);
    if (size.sm) classes.push(`sm:text-${size.sm}`);
    if (size.md) classes.push(`md:text-${size.md}`);
    if (size.lg) classes.push(`lg:text-${size.lg}`);
    if (size.xl) classes.push(`xl:text-${size.xl}`);

    return classes.join(' ');
  };

  const weightClass = `font-${weight}`;
  const leadingClass = `leading-${leading}`;

  return (
    <Component
      className={cn(
        getTextSizeClass(),
        weightClass,
        leadingClass,
        className
      )}
      {...props}
    >
      {children}
    </Component>
  );
}