import { forwardRef } from "react"
import { cn } from "@/libs/utils" // Assuming you have a utility function for class merging

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  asChild?: boolean
}

const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ className, asChild = false, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "rounded-lg border bg-card text-card-foreground shadow-sm",
          className
        )}
        {...props}
      />
    )
  }
)

interface CardHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  asChild?: boolean
}

const CardHeader = forwardRef<HTMLDivElement, CardHeaderProps>(
  ({ className, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn("flex flex-col space-y-1.5 p-6", className)}
        {...props}
      />
    )
  }
)

interface CardTitleProps extends React.HTMLAttributes<HTMLHeadingElement> {
  asChild?: boolean
}

const CardTitle = forwardRef<HTMLParagraphElement, CardTitleProps>(
  ({ className, ...props }, ref) => {
    return (
      <h3
        ref={ref}
        className={cn(
          "text-2xl font-semibold leading-none tracking-tight",
          className
        )}
        {...props}
      />
    )
  }
)

interface CardContentProps extends React.HTMLAttributes<HTMLDivElement> {
  asChild?: boolean
}

const CardContent = forwardRef<HTMLDivElement, CardContentProps>(
  ({ className, ...props }, ref) => {
    return <div ref={ref} className={cn("p-6 pt-0", className)} {...props} />
  }
)

interface CardFooterProps extends React.HTMLAttributes<HTMLDivElement> {
  asChild?: boolean
}

const CardFooter = forwardRef<HTMLDivElement, CardFooterProps>(
  ({ className, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn("flex items-center p-6 pt-0", className)}
        {...props}
      />
    )
  }
)

Card.displayName = "Card"
CardHeader.displayName = "CardHeader"
CardTitle.displayName = "CardTitle"
CardContent.displayName = "CardContent"
CardFooter.displayName = "CardFooter"

export { Card, CardHeader, CardTitle, CardContent, CardFooter }