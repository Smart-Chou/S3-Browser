FROM golang:1.25-alpine AS builder
WORKDIR /src
RUN apk add --no-cache ca-certificates

COPY src/go.mod ./
COPY src/go.sum ./
RUN go mod download

COPY src/ ./
RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -ldflags="-s -w" -o /out/s3-browser

FROM alpine:3.19
RUN apk add --no-cache ca-certificates
COPY --from=builder /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/
COPY --from=builder /out/s3-browser /s3-browser
EXPOSE 8080
ENV PORT=8080
ENTRYPOINT ["/s3-browser"]
