# syntax=docker/dockerfile:1

FROM golang:1.22-alpine AS build
WORKDIR /src
RUN apk add --no-cache git
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /out/logview ./cmd/logview

FROM alpine:3.20
RUN apk add --no-cache ca-certificates
COPY --from=build /out/logview /usr/local/bin/logview
EXPOSE 8080
USER 65534:65534
ENTRYPOINT ["/usr/local/bin/logview"]
CMD ["-addr", ":8080"]
